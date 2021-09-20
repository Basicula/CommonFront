class DropDownButton {
    constructor(header_text, on_open_callback, on_hide_callback) {
        this.header_text = header_text;
        this._init_element();
    }

    _init_element(on_open_callback, on_hide_callback) {
        // main container
        this.element = document.createElement("div");
        // attach callbacks to the main element
        this.element.on_open_callback = on_open_callback;
        this.element.on_hide_callback = on_hide_callback;

        // button itself
        this.button = document.createElement("div");
        this.button.textContent = this.header_text;
        this.is_opened = false;
        this.element.appendChild(this.button);

        // inner div for content can be replaced or extended
        this.inner = document.createElement("div");
        this.inner.style.display = "none";
        this.element.appendChild(this.inner);

        // optional arrow
        this.arrow = document.createElement("i");
        this.arrow.classList.add("fa");
        this.arrow.classList.add("fa-caret-down");
        this.button.appendChild(this.arrow);

        // set additional callbacks
        var self = this;
        this.button.onclick = function() {
            if (!self.is_opened) {
                self.is_opened = true;
                [self.inner.style.display, self.inner.prev_display] = [self.inner.prev_display, self.inner.style.display];

                self.arrow.classList.add("fa-caret-up");
                self.arrow.classList.remove("fa-caret-down");

                if (self.on_open_callback)
                    self.on_open_callback();
            }
            else {
                self.is_opened = false;[self.inner.style.display, self.inner.prev_display] = [self.inner.prev_display, self.inner.style.display];

                self.arrow.classList.add("fa-caret-down");
                self.arrow.classList.remove("fa-caret-up");

                if (self.on_hide_callback)
                    self.on_hide_callback();
            }
        };
    }

    set_inner_content(inner_element) {
        this.element.replaceChild(inner_element, this.inner);
        this.inner = inner_element;
        if (this.is_opened)
            this.inner.prev_display = "none";
        else {
            this.inner.prev_display = this.inner.style.display;
            this.inner.style.display = "none";
        }
    }
}