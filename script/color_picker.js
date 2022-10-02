class ColorPicker {
    constructor() {
        this._init();
        this.color = "#fff";
        this.onchange_callback = function(){};
    }

    _init() {
        this.element = document.createElement("div");

        this.image = document.createElement("img");
        this.image.src = "https://cdn.jsdelivr.net/gh/Basicula/CommonFront@master/images/rgb_wheel.png";
        this.element.appendChild(this.image);

        this.input = document.createElement("input");
        this.input.type = "color";
        this.input.value = this.color;
        this.input.classList.add("color-picker-input");
        this.element.appendChild(this.input);

        var self = this;
        this.element.onclick = function() {
            self.input.click();
        }
        
        var change_color_function = function () {
            self.color = this.value;
            self.onchange_callback();
        };

        this.input.onchange = change_color_function;
        this.input.oninput = change_color_function;
    }
}