// Declare namespace in such way
var CommonUtils = {
    clamp : function(num, min, max) {
        return Math.min(Math.max(num, min), max);
    },

    random : function(min, max) {
        return min + Math.floor((max - min) * Math.random());
    }
};