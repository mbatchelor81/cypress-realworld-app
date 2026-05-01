import bcrypt from "bcryptjs";
import passport from "passport";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../src/models/user";
import { getUserBy, getUserById } from "./database";
import { JWT_SECRET } from "./websocket-server";

const LocalStrategy = require("passport-local").Strategy;
const router = express.Router();

// configure passport for local strategy
passport.use(
  new LocalStrategy(async function (username: string, password: string, done: Function) {
    try {
      const user = await getUserBy("username", username);

      const failureMessage = "Incorrect username or password.";
      if (!user) {
        return done(null, false, { message: failureMessage });
      }

      // validate password
      if (!bcrypt.compareSync(password, user.password)) {
        return done(null, false, { message: failureMessage });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

passport.serializeUser(function (user: User, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id: string, done) {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// authentication routes
router.post("/login", passport.authenticate("local"), (req: Request, res: Response): void => {
  if (req.body.remember) {
    req.session!.cookie.maxAge = 24 * 60 * 60 * 1000 * 30; // Expire in 30 days
  } else {
    req.session!.cookie.expires = undefined;
  }

  const user = req.user as User;
  const wsToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
  res.send({ user: req.user, wsToken });
});

router.post("/logout", (req: Request, res: Response): void => {
  res.clearCookie("connect.sid");
  req.logout(() => res.redirect("/"));
  req.session!.destroy(function (err) {
    res.redirect("/");
  });
});

router.get("/checkAuth", (req, res) => {
  /* istanbul ignore next */
  if (!req.user) {
    res.status(401).json({ error: "User is unauthorized" });
  } else {
    const user = req.user as User;
    const wsToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    res.status(200).json({ user: req.user, wsToken });
  }
});

export default router;
