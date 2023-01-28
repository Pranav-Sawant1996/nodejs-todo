const validator = require("validator");

const cleanUpAndValidate = ({ name, email, password, username }) => {
  return new Promise((resolve, reject) => {
    if (!email || !password || !username) reject("Missing Parameters");

    if (typeof email !== "string") reject("Invalid Email");
    if (typeof name !== "string") reject("Invalid Name");
    if (typeof password !== "string") reject("Invalid Password");
    if (typeof username !== "string") reject("Invalid Username");

    if (!validator.isEmail(email)) reject("Invalid Email Format");

    if (username.length <= 2 || username.length > 49)
      reject("Username length should be 3 to 49 char");
    if (password.length < 4) reject("Password too short");
    if (password.length > 100) reject("Password is too long");

    resolve();
  });
};

module.exports = { cleanUpAndValidate };