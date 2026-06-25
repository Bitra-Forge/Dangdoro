"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyReset = void 0;
const admin = require("firebase-admin");
// Initialize Firebase Admin SDK once at startup
admin.initializeApp();
// Export the scheduled reset Cloud Function
var weeklyReset_1 = require("./weeklyReset");
Object.defineProperty(exports, "weeklyReset", { enumerable: true, get: function () { return weeklyReset_1.weeklyReset; } });
//# sourceMappingURL=index.js.map