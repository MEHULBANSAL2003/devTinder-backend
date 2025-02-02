require("dotenv").config();
const express = require("express");
const app = express();
const { connectDB } = require("./src/config/database.js");
const User = require("./src/models/user.js");
const cookieParser = require("cookie-parser");
app.use(express.json()); // middleware to parse the data to json from client;
app.use(cookieParser());
const cors = require("cors");
const { authRouter } = require("./src/routers/auth.js");
const { profileRouter } = require("./src/routers/profile.js");
const { requestRouter } = require("./src/routers/requests.js");
const { userRouter } = require("./src/routers/user.js");
const { postRouter } = require("./src/routers/posts.js");

const corsOptions = {
  origin: "http://localhost:5173",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use("/", authRouter);

app.use("/", profileRouter);

app.use("/", requestRouter);

app.use("/", userRouter);

app.use("/", postRouter);

connectDB()
  .then(() => {
    console.log("connected to db succesfuly");
    app.listen(process.env.PORT, () => {
      console.log(`server listening on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("an error occured while connecting to database", err);
  });
