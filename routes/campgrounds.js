var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var { checkCampgroundOwnership, isLoggedIn } = require("../middleware");

//=========================
// GEOCODER SETUP CODE
// ========================
var NodeGeocoder = require("node-geocoder");

var options = {
  provider: "google",
  httpAdapter: "https",
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
var geocoder = NodeGeocoder(options);

// ===============================================
// IMAGE UPLOAD SETUP CODE
// ===============================================
var multer = require("multer");
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function(req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: "sayands1997",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// =========================
//  CAMPGROUND ROUTES
// =========================

//INDEX - show all campgrounds
router.get("/", function(req, res) {
  var perPage = 8;
  var pageQuery = parseInt(req.query.page);
  var pageNumber = pageQuery ? pageQuery : 1;
  var noMatch = null;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi");
    Campground.find({ name: regex })
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec(function(err, allCampgrounds) {
        Campground.count({ name: regex }).exec(function(err, count) {
          if (err) {
            console.log(err);
            res.redirect("back");
          } else {
            if (allCampgrounds.length < 1) {
              noMatch = "No campgrounds match that query, please try again.";
            }
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              noMatch: noMatch,
              search: req.query.search
            });
          }
        });
      });
  } else {
    // get all campgrounds from DB
    Campground.find({})
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec(function(err, allCampgrounds) {
        Campground.count().exec(function(err, count) {
          if (err) {
            console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              noMatch: noMatch,
              search: false
            });
          }
        });
      });
  }
});

//CREATE - add new campground to DB
router.post("/", isLoggedIn, upload.single("image"), function(req, res) {
  // get data from form and add to campgrounds array
  var name = req.body.name;
  var desc = req.body.description;
  var price = req.body.price;
  var author = {
    id: req.user._id,
    username: req.user.username
  };
  geocoder.geocode(req.body.location, function(err, data) {
    if (err || !data.length) {
      req.flash("error", "Invalid address");
      return res.redirect("back");
    }
    var lat = data[0].latitude;
    var lng = data[0].longitude;
    var location = data[0].formattedAddress;

    // image upload
    cloudinary.uploader.upload(req.file.path, function(result) {
      // add cloudinary url for the image to the campground object under image property
      //req.body.campground.image = result.secure_url;
      // add author to campground
      req.body.campground.author = {
        id: req.user._id,
        username: req.user.username
      };

      var newCampground = {
        name: name,
        image: result.secure_url,
        description: desc,
        author: author,
        location: location,
        lat: lat,
        lng: lng,
        price: price
      };

      //   Campground.create(req.body.campground, function(err, campground) {
      //     if (err) {
      //       req.flash("error", err.message);
      //       return res.redirect("back");
      //     }
      //     res.redirect("/campgrounds/" + campground.id);
      //   });
      // });

      // Create a new campground and save to DB
      Campground.create(newCampground, function(err, newlyCreated) {
        if (err) {
          console.log(err);
        } else {
          //redirect back to campgrounds page
          console.log(newlyCreated);
          res.redirect("/campgrounds/" + newlyCreated.id);
        }
      });
    });
  });
});
//NEW - Show form to create new campgrounds
router.get("/new", isLoggedIn, function(req, res) {
  res.render("campgrounds/new");
});

//SHOW - shows more info about one campground
router.get("/:id", function(req, res) {
  //find the campground with provided id
  Campground.findById(req.params.id)
    .populate("comments")
    .exec(function(err, foundCampground) {
      if (err) {
        console.log(err);
      } else {
        //console.log(foundCampground);
        //render show template with that campground
        res.render("campgrounds/show", { campground: foundCampground });
      }
    });
});

// EDIT CAMPGROUND ROUTE
router.get("/:id/edit", checkCampgroundOwnership, function(req, res) {
  // is user logged in
  Campground.findById(req.params.id, function(err, foundCampground) {
    res.render("campgrounds/edit", { campground: foundCampground });
  });
});

// UPDATE CAMPGROUND ROUTE
router.put("/:id", checkCampgroundOwnership, function(req, res) {
  geocoder.geocode(req.body.location, function(err, data) {
    if (err || !data.length) {
      req.flash("error", "Invalid address");
      return res.redirect("back");
    }
    req.body.campground.lat = data[0].latitude;
    req.body.campground.lng = data[0].longitude;
    req.body.campground.location = data[0].formattedAddress;

    Campground.findByIdAndUpdate(req.params.id, req.body.campground, function(
      err,
      campground
    ) {
      if (err) {
        req.flash("error", err.message);
        res.redirect("back");
      } else {
        req.flash("success", "Successfully Updated!");
        res.redirect("/campgrounds/" + campground._id);
      }
    });
  });
});

// DESTROY CAMPGROUND ROUTE
router.delete("/:id", checkCampgroundOwnership, function(req, res) {
  Campground.findByIdAndRemove(req.params.id, function(err) {
    if (err) {
      res.redirect("/campgrounds");
    } else {
      res.redirect("/campgrounds");
    }
  });
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
