var express = require("express");
var app = express();

var formidable = require("express-formidable");
app.use(formidable());
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var fileSystem = require("fs");

var jwt = require("jsonwebtoken");
var accessTokenSecret = "myAccessTokenSecret123467890";

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];
var mainURL = "http://localhost:3000";

socketIO.on("connection", function (socket) {
  console.log("User Connection", socket.id);
  socketID = socket.id;
});

http.listen(3000, function () {
  console.log("server started.");

  mongoClient.connect("mongodb://localhost:27017", function (err, client) {
    var database = client.db("ffsdproject");
    console.log("Database connected");

    app.get("/", function (request, result) {
      result.render("landingpage");
    });
    app.get("/index", function (request, result) {
      result.render("index");
    });

    app.get("/signup", function (request, result) {
      result.render("signup");
    });
    app.post("/signup", function (request, result) {
      var name = request.fields.name;
      var username = request.fields.username;
      var email = request.fields.email;
      var password = request.fields.password;
      var confpass=request.fields.confirmpassword;
      var gender = request.fields.gender;
      var reset_token = "";

      database.collection("users").findOne(
        {
          $or: [
            {
              email: email,
            },
            {
              username: username,
            },
          ],
        },
        function (error, user) {
          if(password)
          if (user == null) {
            bcrypt.hash(password, 10, function (error, hash) {
              database.collection("users").insertOne(
                {
                  name: name,
                  username: username,
                  email: email,
                  password: hash,
                  gender: gender,
                  reset_token: reset_token,
                  profileImage: "",
                  coverPhoto: "",
                  dob: "",
                  city: "",
                  country: "",
                  aboutMe: "",
                  friends: [],
                  pages: [],
                  notifications: [],
                  groups: [],
                  posts: [],
                },
                function (error, data) {
                  result.json({
                    status: "success",
                    message: "Signed up successfully. You can login now.",
                  });
                }
              );
            });
          } else {
            result.json({
              status: "error",
              message: "Email or username already exist.",
            });
          }
        }
      );
    });

    app.get("/login", function (request, result) {
      result.render("login");
    });

    app.post("/login", function (request, result) {
      var email = request.fields.email;
      var password = request.fields.password;
      database.collection("users").findOne(
        {
          email: email,
        },
        function (error, user) {
          if (user == null) {
            result.json({
              status: "error",
              message: "Email does not exist",
            });
          } else {
            bcrypt.compare(password, user.password, function (error, isVerify) {
              if (isVerify) {
                var accessToken = jwt.sign({ email: email }, accessTokenSecret); //generate access token
                database.collection("users").findOneAndUpdate(
                  {
                    email: email,
                  },
                  {
                    $set: {
                      accessToken: accessToken,
                    },
                  },
                  function (error, data) {
                    result.json({
                      status: "success",
                      message: "Login successfully",
                      accessToken: accessToken,
                      profileImage: user.profileImage,
                    });
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Password is not correct",
                });
              }
            });
          }
        }
      );
    });
    app.get("/updateProfile", function (request, result) {
      result.render("updateProfile");
    });
    app.post("/getUser", function (request, result) {
      var accessToken = request.fields.accessToken;
      database.collection("users").findOne(
        {
          accessToken: accessToken,
        },
        function (error, user) {
          if (user == null) {
            result.json({
              status: "error",
              message: "User has been logged out. Please login again.",
            });
          } else {
            result.json({
              status: "success",
              message: "Record has been fetched.",
              data: user,
            });
          }
        }
      );
    });

    app.get("/logout", function (request, result) {
      result.redirect("/login");
    });

    app.post("/uploadCoverPhoto", function (request, result) {
      var accessToken = request.fields.accessToken;
      var coverPhoto = "";

      database.collection("users").findOne(
        {
          accessToken: accessToken,
        },
        function (error, user) {
          if (user == null) {
            result.json({
              status: "error",
              message: "User has been logged out. Please login again.",
            });
          } else {
            if (
              request.files.coverPhoto.size > 0 &&
              request.files.coverPhoto.type.includes("image")
            ) {
              if (user.coverPhoto != "") {
                fileSystem.unlink(user.coverPhoto, function (error) {
                  //
                });
              }

              coverPhoto =
                "public/images/" +
                new Date().getTime() +
                "-" +
                request.files.coverPhoto.name;

              // Read the file
              fileSystem.readFile(
                request.files.coverPhoto.path,
                function (err, data) {
                  if (err) throw err;
                  console.log("File read!");

                  // Write the file
                  fileSystem.writeFile(coverPhoto, data, function (err) {
                    if (err) throw err;
                    console.log("File written!");

                    database.collection("users").updateOne(
                      {
                        accessToken: accessToken,
                      },
                      {
                        $set: {
                          coverPhoto: coverPhoto,
                        },
                      },
                      function (error, data) {
                        result.json({
                          status: "status",
                          message: "Cover photo has been updated.",
                          data: mainURL + "/" + coverPhoto,
                        });
                      }
                    );
                  });

                  // Delete the file
                  fileSystem.unlink(
                    request.files.coverPhoto.path,
                    function (err) {
                      if (err) throw err;
                      console.log("File deleted!");
                    }
                  );
                }
              );
            } else {
              result.json({
                status: "error",
                message: "Please select valid image.",
              });
            }
          }
        }
      );
      
    });
	app.post("/uploadProfileImage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var profileImage = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.profileImage.size > 0 &&
                request.files.profileImage.type.includes("image")
              ) {
                if (user.profileImage != "") {
                  fileSystem.unlink(user.profileImage, function (error) {
                    //
                  });
                }

                profileImage =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.profileImage.name;

                // Read the file
                fileSystem.readFile(
                  request.files.profileImage.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(profileImage, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");

                      database.collection("users").updateOne(
                        {
                          accessToken: accessToken,
                        },
                        {
                          $set: {
                            profileImage: profileImage,
                          },
                        },
                        function (error, data) {
                          result.json({
                            status: "status",
                            message: "Profile image has been updated.",
                            data: mainURL + "/" + profileImage,
                          });
                        }
                      );
                    });

                    // Delete the file
                    fileSystem.unlink(
                      request.files.profileImage.path,
                      function (err) {
                        if (err) throw err;
                        console.log("File deleted!");
                      }
                    );
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });
      app.post("/updateProfile",function(request,result){
        var accessToken=request.fields.accessToken;
        var name=request.fields.name;
        var dob=request.fields.dob;
        var city=request.fields.city;
        var country=request.fields.country;
        var aboutMe=request.fields.aboutMe;

        database.collection("users").findOne({
          "accessToken":accessToken
        },function(error,user){
          if(user==null)
          {
            result.json({
              "status":"error",
              "message":"User has been logged out. Please login again"
            });
          }
          else{
            database.collection("users").updateOne({
              "accessToken":accessToken
            },{
              $set:{
                "name":name,
                "dob":dob,
                "city":city,
                "country":country,
                "aboutMe":aboutMe
              }
            },function(error,data){
              result.json({
                "status":"status",
                "message":"Profile has been updated"
              });
            });
          }
        });
      });
      app.post("/addPost",function(request,result){
        var accessToken=request.fields.accessToken;
        var caption=request.fields.caption;
        var image="";
        var video="";
        var type=request.fields.type;
        var createdAt=new Date().getTime();
        var _id=request.fields._id;
        database.collection("users").findOne({
          "accessToken":accessToken
        },function (error,user) { 
          if(user==null){
            result.json({
              "status":"error",
              "message":"User has been logged out.Please login again"
            });
          }else
          {
            if(request.files.image.size>0&&request.files.image.type.includes("image")){
               image="public/images"+new Date().getTime+"-"+request.files.image.name;
               fileSystem.rename(request.files.image.path,image,function(error){

               });
             }
             if(request.files.video.size>0&&request.files.video.type.includes("video"))
             {
               image="public/videos"+new Date().getTime+"-"+request.files.video.name;
               fileSystem.rename(request.files.video.path,video,function(error){

               });
             }
            database.collection("posts").insertOne({
              "caption":caption,
              "image":image,
              "video":video,
              "type":type,
              "createdAt":createdAt,
              "likers":[],
              "shares":[],
              "user":{
                "_id":user._id,
                "name":user.name,
                "profileImage":user.profileImage
              }
            },function(error,data){
              database.collection("users").updateOne({
                "accessToken":accessToken
              },{
                $push:{
                  "posts":{
                    "_id":data.insertedId,
                    "caption":caption,
                    "image":image,
                    "video":video,
                    "type":type,
                    "createdAt":createdAt,
                    "likers":[],
                    "shares":[],

                  }
                }
              },function(error,data){
                result.json({
                  "status":"success",
                  "message":"Post has been uploaded"
                });
              });
            });
          };
      });
      app.post("/getNewsfeed", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne({
          "accessToken": accessToken
        }, function (error, user) {
          if (user == null) {
            result.json({
              "status": "error",
              "message": "User has been logged out. Please login again."
            });
          } else {
  
            var ids = [];
            ids.push(user._id);
  
            database.collection("posts")
            .find({
              "user._id": {
                $in: ids
              }
            })
            .sort({
              "createdAt": -1
            })
            .limit(5)
            .toArray(function (error, data) {
  
              result.json({
                "status": "success",
                "message": "Record has been fetched",
                "data": data
              });
            });
          }
        });
      });
      app.post("/toggleLikePost", function (request, result) {

        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
  
        database.collection("users").findOne({
          "accessToken": accessToken
        }, function (error, user) {
          if (user == null) {
            result.json({
              "status": "error",
              "message": "User has been logged out. Please login again."
            });
          } else {
  
            database.collection("posts").findOne({
              "_id": ObjectId(_id)
            }, function (error, post) {
              if (post == null) {
                result.json({
                  "status": "error",
                  "message": "Post does not exist."
                });
              } else {
  
                var isLiked = false;
                for (var a = 0; a < post.likers.length; a++) {
                  var liker = post.likers[a];
  
                  if (liker._id.toString() == user._id.toString()) {
                    isLiked = true;
                    break;
                  }
                }
  
                if (isLiked) {
                  database.collection("posts").updateOne({
                    "_id": ObjectId(_id)
                  }, {
                    $pull: {
                      "likers": {
                        "_id": user._id,
                      }
                    }
                  }, function (error, data) {
  
                    database.collection("users").updateOne({
                      $and: [{
                        "_id": post.user._id
                      }, {
                        "posts._id": post._id
                      }]
                    }, {
                      $pull: {
                        "posts.$[].likers": {
                          "_id": user._id,
                        }
                      }
                    });
  
                    result.json({
                      "status": "unliked",
                      "message": "Post has been unliked."
                    });
                  });
                } else {
  
                  database.collection("users").updateOne({
                    "_id": post.user._id
                  }, {
                    $push: {
                      "notifications": {
                        "_id": ObjectId(),
                        "type": "photo_liked",
                        "content": user.name + " has liked your post.",
                        "profileImage": user.profileImage,
                        "isRead": false,
                        "post": {
                          "_id": post._id
                        },
                        "createdAt": new Date().getTime()
                      }
                    }
                  });
  
                  database.collection("posts").updateOne({
                    "_id": ObjectId(_id)
                  }, {
                    $push: {
                      "likers": {
                        "_id": user._id,
                        "name": user.name,
                        "profileImage": user.profileImage
                      }
                    }
                  }, function (error, data) {
  
                    database.collection("users").updateOne({
                      $and: [{
                        "_id": post.user._id
                      }, {
                        "posts._id": post._id
                      }]
                    }, {
                      $push: {
                        "posts.$[].likers": {
                          "_id": user._id,
                          "name": user.name,
                          "profileImage": user.profileImage
                        }
                      }
                    });
  
                    result.json({
                      "status": "success",
                      "message": "Post has been liked."
                    });
                  });
                }
  
              }
            });
  
          }
        });
      });
      
      app.post("/sharePost", function (request, result) {

        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var type = "shared";
        var createdAt = new Date().getTime();
  
        database.collection("users").findOne({
          "accessToken": accessToken
        }, function (error, user) {
          if (user == null) {
            result.json({
              "status": "error",
              "message": "User has been logged out. Please login again."
            });
          } else {
  
            database.collection("posts").findOne({
              "_id": ObjectId(_id)
            }, function (error, post) {
              if (post == null) {
                result.json({
                  "status": "error",
                  "message": "Post does not exist."
                });
              } else {
  
                database.collection("posts").updateOne({
                  "_id": ObjectId(_id)
                }, {
                  $push: {
                    "shares": {
                      "_id": user._id,
                      "name": user.name,
                      "profileImage": user.profileImage
                    }
                  }
                }, function (error, data) {
  
                  database.collection("posts").insertOne({
                    "caption": post.caption,
                    "image": post.image,
                    "video": post.video,
                    "type": type,
                    "createdAt": createdAt,
                    "likers": [],
                    // "comments": [],
                    "shares": [],
                    "user": {
                      "_id": user._id,
                      "name": user.name,
                      "gender": user.gender,
                      "profileImage": user.profileImage
                    }
                  }, function (error, data) {
  
                    database.collection("users").updateOne({
                      $and: [{
                        "_id": post.user._id
                      }, {
                        "posts._id": post._id
                      }]
                    }, {
                      $push: {
                        "posts.$[].shares": {
                          "_id": user._id,
                          "name": user.name,
                          "profileImage": user.profileImage
                        }
                      }
                    });
  
                    result.json({
                      "status": "success",
                      "message": "Post has been shared."
                    });
                  });
                });
              }
            });
          }
        });
      });
  });
  app.get("/search/:query", function (request, result) {
    var query = request.params.query;
    result.render("search", {
      "query": query
    });
  });
  app.post("/search", function (request, result) {
    var query = request.fields.query;
    database.collection("users").find({
      "name": {
        $regex: ".*" + query + ".*",
        $options: "i"
      }
    }).toArray(function (error, data) {

      result.json({
        "status": "success",
        "message": "Record has been fetched",
        "data": data
      });
    });
  });
  app.post("/sendFriendRequest",function(request,result){
    var accessToken=request.fields.accessToken;
    var _id=request.fields._id;
    database.collection("users").findOne({
      "accessToken":accessToken
    },function(error,user){
      if(user==null){
        result.json({
          "status":"error",
          "message":"User has been logged out.Please login again"
        });
      }
      else
      {
        var me=user;
        database.collection("users").findOne({
          "_id":ObjectId(_id)
        },function(error,user){
          if(user==null){
            result.json({
              "status":"error",
              "message":"User does not exist "
            });
          }
          else
          {
            database.collection("users").updateOne({
              "_id":ObjectId(_id)
            },{
              $push:{
                "friends":{
                  "_id":me._id,
                  "name":me.name,
                  "profileImage":me.profileImage,
                  "status":"Pending",
                  "sentByMe":false,
                  "inbox":[]

                }
              }
            },function(error,data){
                database.collection("users").updateOne({
                  "_id":me._id
                },{
                  $push:{"friends":{
                    "_id":user._id,
                    "name":user.name,
                    "profileImage":user.profileImage,
                    "status":"Pending",
                    "sentByMe":true,
                    "inbox":[]
                  }
                }
                },function(error,data){
                  result.json({
                    "status":"success",
                    "message":"Friend Request has been sent"
                 })
                })
            })
          }
        })
      }
    })
  })
  app.get("/friends",function(request,result){
    result.render("friends");
  });
  app.post("/acceptFriendRequest",function(request,result){
    var accessToken=request.fields.accessToken;
    var _id=request.fields._id;
    database.collection("users").findOne({
      "accessToken":accessToken,
      function(error,user){
        if(user==null){
          result.json({
            "status":"error",
            "message":"User has been logged out.Please Login again."
          });
        }
        else
        {
          var me=user;
          database.collection("users").findOne({
            "_id":ObjectId(_id)
          },function(error,user){
            if(user==null){
              result.json({
                "status":"error",
                "message":"user doesnot exist"
              });
            }
            else{
              database.collection("users").updateOne({
                "_id":ObjectId(_id)
              },{
                $push:{
                  "notifications":{
                    "_id":ObjectId(),
                    "type":"friend_request_accepted",
                    "content":me.name+"accepted your friend request.",
                    "profileImage":me.profileImage,
                    "createdAt":new Date().getTime()
                  }
                }
              });
              database.collection("users").updateOne({
                $and:[{
                  "_id":ObjectId(_id)
                },{
                  "friends._id":me._id
                }]
              },{
                $set:{
                  "friends.$.status":"Accepted"
                }
              },function(error,data){
                database.collection("users").updateOne({
                  $and:[{
                    "_id":me._id
                  },{
                    "friends._id":user._id
                  }]
                },{
                  $set:{
                    "friends.$.status":"Accepted"
                  }
                },function(error,data){
                  result.json({
                    "status":"success",
                    "message":"Friend Request has been accepted"
                  })
                })
              })
            }
          }
          )
        }
      }
    })
  })
  app.get("/inbox",function(request,result){
    result.render("inbox");
  });
  app.get("/createPage",function(request,result){
    result.render("createPage");
  });
  app.get("/pages",function(request,result){
    result.render("pages");
  });
  app.get("/createGroup",function(request,result){
    result.render("createGroup");
  });
  app.get("/groups",function(request,result){
    result.render("groups");
  })
  app.get("/notifications",function(request,result){
    result.render("notifications");
  })
});
});

