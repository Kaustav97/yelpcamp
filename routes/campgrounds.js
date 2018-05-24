var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var { checkCampgroundOwnership, isLoggedIn } = require("../middleware");

var NodeGeocoder = require("node-geocoder");

var options = {
  provider: "google",
  httpAdapter: "https",
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};

var geocoder = NodeGeocoder(options);
// =========================
//  CAMPGROUND ROUTES
// =========================

// INDEX - show all campgrounds
router.get("/", function(req, res) {
  var perPage = 8;
  var pageQuery = parseInt(req.query.page);
  var pageNumber = pageQuery ? pageQuery : 1;
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
            pages: Math.ceil(count / perPage)
          });
        }
      });
    });
});

//CREATE - add new campground to DB
router.post("/", isLoggedIn, function(req, res) {
  // get data from form and add to campgrounds array
  var name = req.body.name;
  var image = req.body.image;
  var desc = req.body.description;
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
    var newCampground = {
      name: name,
      image: image,
      description: desc,
      author: author,
      location: location,
      lat: lat,
      lng: lng
    };
    // Create a new campground and save to DB
    Campground.create(newCampground, function(err, newlyCreated) {
      if (err) {
        console.log(err);
      } else {
        //redirect back to campgrounds page
        console.log(newlyCreated);
        res.redirect("/campgrounds");
      }
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

module.exports = router;
