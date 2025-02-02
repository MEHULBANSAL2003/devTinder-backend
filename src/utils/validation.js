const validator = require("validator");
const ConnectionRequestModel = require("../models/connectionRequests");
const User = require("../models/user");

const validateSignUpData = (req) => {
  const { firstName, lastName, userName, gender, age, emailId, password } =
    req.body;

  if (!firstName || !lastName) {
    throw { status: 400, message: "Name is required" };
  }

  if (firstName.length < 4 || firstName.length > 50) {
    throw { status: 400, message: "name should contain 4-50 characters" };
  }
  if (userName === "") throw { status: 400, message: "username is required" };
  if (userName.length < 4 || userName.length > 50) {
    throw { status: 400, message: "user name should contain 4-50 characters" };
  }

  if (age === "") throw { status: 400, message: "Age is required" };
  if (gender === "")
    throw { status: 400, message: "PLease select your gender" };
  if (age < 18) {
    throw { status: 400, message: "You must be minimum 18 years old" };
  }

  if (!validator.isEmail(emailId)) {
    throw { status: 400, message: "Invalid email" };
  }

  if (!validator.isStrongPassword(password)) {
    throw { status: 400, message: "enter strong password" };
  }
};

const validateLoginData = (req) => {
  if (!validator.isEmail(req.body.emailId)) {
    throw { status: 400, message: "Invalid email" };
  }
};

const validateProfileEditData = (req) => {
  const allowedEditFeilds = [
    "firstName",
    "lastName",
    "age",
    "about",
    "gender",
    "skills",
  ];

  const isEditAllowed = Object.keys(req.body).every((field) =>
    allowedEditFeilds.includes(field)
  );

  return isEditAllowed;
};

const validateEditPassword = (req) => {
  if (!req.body.password) {
    throw new Error("please enter the password");
  }

  const { password } = req.body;

  if (!validator.isStrongPassword(password)) {
    throw new Error("enter the strong password");
  }
};

const validateSendConnectionRequestData = async (req) => {
  // only ignored and interested stauts should be allowed
  // toUserId should be in the db
  //user cannot send request to itself
  // duplicate requests are not allowed..
  // if there is connection request from A to B then B should not be able to send request to A

  const fromUserId = req.user._id;
  const toUserId = req.params.toUserId;
  const status = req.params.status;

  const allowedStatus = ["ignored", "interested"];
  if (!allowedStatus.includes(status)) {
    throw { status: 400, message: `invalid status type: ${status}` };
  }

  const toUser = await User.findById(toUserId);

  if (!toUser) {
    throw { status: 400, message: "user doesn't exist" };
  }

  // we can also do this with mongoose pre middleware
  if (fromUserId.equals(toUserId)) {
    throw { status: 400, message: "can't send request to youself" };
  }

  const existingRequest = await ConnectionRequestModel.findOne({
    $or: [
      { fromUserId, toUserId },
      { fromUserId: toUserId, toUserId: fromUserId },
    ],
  });

  if (existingRequest) {
    throw { status: 400, message: "request already exists" };
  }
};

const validateRequestReviewData = async (req) => {
  // toUserid should be the logged in id to accept or reject the request
  // requestId shoulbe be valid
  // request can only be accepted or rejected if status is interested
  // allowed status are accepted or rejected

  const currUser = req.user;
  const requestId = req.params.requestId;
  const status = req.params.status;
  const request = await ConnectionRequestModel.findById(requestId);
  if (!request) {
    throw { status: 400, message: "invalid request id" };
  }

  const toUserId = request.toUserId;

  if (!currUser.equals(toUserId)) {
    throw { status: 400, message: "you are not logged in" };
  }

  const allowedStatus = ["accepted", "rejected"];

  if (!allowedStatus.includes(status)) {
    throw { status: 400, message: `invalid status type : ${status}` };
  }

  if (request.status !== "interested") {
    throw { status: 400, message: "not allowed to change the status" };
  }

  req.request = request;
};

module.exports = {
  validateSignUpData,
  validateLoginData,
  validateProfileEditData,
  validateEditPassword,
  validateSendConnectionRequestData,
  validateRequestReviewData,
};
