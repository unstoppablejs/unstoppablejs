"use strict"

if (process.env.NODE_ENV === "production") {
  module.exports = require("./storage.cjs.production.min.js")
} else {
  module.exports = require("./storage.cjs.development.js")
}
