const express = require("express");
const authRouter = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/user.js");
const {
  validateSignUpData,
  validateLoginData,
} = require("../utils/validation.js");
const { putObjectInS3, deleteObjectFromS3 } = require("../utils/s3.js");
const { userAuth } = require("../middlewares/auth.js");

authRouter.post("/signup", async (req, res) => {
  try {
    validateSignUpData(req);
    const {
      firstName,
      lastName,
      userName,
      imageUrl,
      gender,
      age,
      emailId,
      password,
    } = req.body;

    const registeredUser = await User.find({ emailId: emailId });
    if (registeredUser.length > 0) {
      throw { status: 400, message: "User already exists. Login to access" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let data = {
      firstName,
      lastName,
      userName,
      gender,
      age,
      emailId,
      password: hashedPassword,
    };
    if (imageUrl) data.photoUrl = imageUrl;

    const user = new User(data);
    await user.save();

    const token = await user.getJWT();

    res.cookie("token", token, {
      expires: new Date(Date.now() + 1 * 3600000),
    });

    res.json({
      result: "success",
      message: "user added successfully",
      data: user,
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    validateLoginData(req);
    const user = await User.findOne({ emailId: emailId });
    if (!user) {
      throw { status: 400, message: "User not registered. Sign up first" };
    }

    const isPasswordValid = await user.validatePassword(password);
    if (isPasswordValid) {
      const token = await user.getJWT();
      res.cookie("token", token, {
        expires: new Date(Date.now() + 24 * 3600000),
      });
      res.json({
        result: "success",
        message: "logged in successfully",
        data: user,
      });
    } else {
      throw { status: 400, message: "Incorrect Password" };
    }
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    res.cookie("token", null, { expires: new Date(Date.now()) });

    res.json({
      result: "success",
      message: "logged out sucessfully",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

authRouter.post("/generate-upload-url", async (req, res) => {
  const { filename, contentType } = req.body;

  if (!filename || !contentType) {
    return res
      .status(400)
      .json({ result: "error", message: "Missing filename or content-type." });
  }

  try {
    const response = await putObjectInS3(filename, contentType);
    if (response.result === "success") {
      res.status(response.status).json(response);
    } else {
      res.status(response.status).json(response.message);
    }
  } catch (err) {
    res.status(err.status || 500).json({
      result: "error",
      message: err.message || "Internal server error",
    });
  }
});

authRouter.post("/deleteS3image", userAuth, async (req, res) => {
  const { imageKey } = req.body;

  if (!imageKey) {
    return res.status(400).json({
      result: "error",
      message: "Image key is required",
    });
  }

  try {
    const response = await deleteObjectFromS3(imageKey);

    if (response.result === "success") {
      return res.status(200).json({
        result: "success",
        message: response.message,
      });
    } else {
      return res.status(400).json({
        result: "error",
        message: response.message || "Failed to delete image from S3",
      });
    }
  } catch (err) {
    console.error("Error in deleting image:", err);
    return res.status(500).json({
      result: "error",
      message: "An error occurred while deleting the image",
    });
  }
});

module.exports = { authRouter };
