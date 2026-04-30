"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaybackMode = exports.ContentType = exports.ScreenStatus = exports.AdNexusRole = void 0;
var AdNexusRole;
(function (AdNexusRole) {
    AdNexusRole["Admin"] = "admin";
    AdNexusRole["Campaigner"] = "campaigner";
    AdNexusRole["Screen"] = "screen";
})(AdNexusRole || (exports.AdNexusRole = AdNexusRole = {}));
var ScreenStatus;
(function (ScreenStatus) {
    ScreenStatus["Online"] = "online";
    ScreenStatus["Offline"] = "offline";
})(ScreenStatus || (exports.ScreenStatus = ScreenStatus = {}));
var ContentType;
(function (ContentType) {
    ContentType["Image"] = "image";
    ContentType["Video"] = "video";
})(ContentType || (exports.ContentType = ContentType = {}));
var PlaybackMode;
(function (PlaybackMode) {
    PlaybackMode["Continuous"] = "Continuous";
    PlaybackMode["Single"] = "Single";
})(PlaybackMode || (exports.PlaybackMode = PlaybackMode = {}));
//# sourceMappingURL=adnexus.types.js.map