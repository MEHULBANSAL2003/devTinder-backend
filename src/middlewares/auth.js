const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    const cookies = req.cookies;

    const { token } = cookies;

    if (!token) {
       return res.status(401).send("please login!!");
    }

    const validateToken = await jwt.verify(token, process.env.JWT_SECRET_KEY);

    const { _id } = validateToken;

    const user = await User.findById(_id);
    if (!user) {
      throw {status:400,message:"User not found.Login to access"};
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(err.status||500).json({
      result: "error",
      message: err.message||"Internal server error",
    });
  }
};

module.exports = { userAuth };
