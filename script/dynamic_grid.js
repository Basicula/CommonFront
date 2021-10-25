const SPACE_CELL_ID = -1;

const SPLITTERS_START_ID = -2;
const HORIZONTAL_SPLITTER_START_ID = -2;
const VERTICAL_SPLITTER_START_ID = -3;

const SPLITTER_ELEMENT_ID_PREFIX = "splitter_"
const GRID_CELL_ELEMENT_ID_PREFIX = "grid_cell_"

const SplitterOrientation = Object.freeze({Horizontal : 1, Vertical : 2});

// Splitter class represents element that resize neighbor grid elements
class Splitter {
    constructor(orientation, thickness, id) {
        this.orientation = orientation;
        this.thickness = thickness;
        this.id = id;

        this.length = 0;
        this.range = [-Infinity, Infinity];
        this.position = [0, 0];

        // Callback function to process delta after splitter move
        this.onmove = function (delta) {};

        this._init();
    }

    _init() {
        this.element = document.createElement("div");
        this.element.classList.add("splitter-container");
        this.element.id = SPLITTER_ELEMENT_ID_PREFIX + this.id;

        this.splitter = document.createElement("div");
        this.splitter.classList.add("splitter");
        this.element.appendChild(this.splitter);
        
        switch (this.orientation) {
            case SplitterOrientation.Horizontal:
                this.element.classList.add("horizontal-splitter");
                break;
            case SplitterOrientation.Vertical:
                this.element.classList.add("vertical-splitter");
                break;
            default:
                throw new Error("Undefined splitter orientation");
        }

        var self = this;
        this.onmousemove = function(event) {
            var new_pos = [self.position[0], self.position[1]];
            switch (this.orientation) {
                case SplitterOrientation.Horizontal:
                    new_pos[1] = event.pageY - self.element.parentElement.getBoundingClientRect().top - self.thickness;
                    break;
                case SplitterOrientation.Vertical:
                    new_pos[0] = event.pageX - self.element.parentElement.getBoundingClientRect().left - self.thickness;
                    break;
            }
            self.onmove([self.position[0] - new_pos[0], self.position[1] - new_pos[1]]);
            self.set_position(new_pos);
        }

        this.element.onmousedown = function() {
            var move = function(event) {
                self.onmousemove(event);
            }
            var stopselect = function(e) {
                e.preventDefault();
            }
            var stop = function() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('selectstart', stopselect);
            }
            document.addEventListener('selectstart', stopselect);
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", stop);
        }
    }

    set_length(new_length) {
        this.length = new_length;
        switch (this.orientation) {
            case SplitterOrientation.Horizontal:
                this.element.style.height = this.thickness + "px";
                this.element.style.width = this.length + "px";
                this.splitter.style.height = this.thickness + "px";
                this.splitter.style.width = "50%";
                break;
            case SplitterOrientation.Vertical:
                this.element.style.width = this.thickness + "px";
                this.element.style.height = this.length + "px";
                this.splitter.style.width = this.thickness + "px";
                this.splitter.style.height = "50%";
                break;
        }
    }

    set_position(new_pos) {
        this.position = new_pos;
        this.element.style.left = this.position[0] + "px";
        this.element.style.top = this.position[1] + "px"
    }

    set_range(new_range) {
        this.range = new_range;
    }
}

class DynamicGrid {
    // Accepts matrix with values >=0
    // Each id will map then on array of div inside grid
    // grid_height and grid_width commonly parent element size in pixels
    // Example
    // | 0 1 2 |   | divs[0] divs[1] divs[2] |
    // | 0 1 2 | = | divs[0] divs[1] divs[2] | or in short | divs[0] divs[1] divs[2] |
    // | 0 1 2 |   | divs[0] divs[1] divs[2] |
    constructor(grid_matrix, grid_height, grid_width) {
        this.grid_matrix = grid_matrix;
        this.height = this.grid_matrix.length;
        this.width = this.grid_matrix[0].length;
        this.cells_width = this.width;
        this.cells_height = this.height;

        if (!this._is_valid_matrix())
            throw new Error("Invalid grid setting");
        
        this.splitter_thickness = 7;
        if (!grid_height)
            this.grid_height = document.body.clientHeight;
        else
            this.grid_height = grid_height;
        if (!grid_width)
            this.grid_width = document.body.clientWidth;
        else
            this.grid_width = grid_width;

        this._prepare_data();

        this._init()
    }

    // Check funtion that detects input matrix validity
    _is_valid_matrix() {
        // Check that all indices in matrix are valid i.e. >= 0
        for (let row_id = 0; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id)
                if (this.grid_matrix[row_id][column_id] < 0)
                    return false;

        // Fill up check matrix
        var checked = [];
        for (let row_id = 0; row_id < this.height; ++row_id) {
            checked.push([]);
            for (let column_id = 0; column_id < this.width; ++column_id)
                checked[row_id].push(false);
        }
        var processed_ids = [];
        // Check that all inner elements have rectangular form
        for (let row_id = 0; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id) {
                if (checked[row_id][column_id])
                    continue;
                
                const component = this._find_cell_component(checked, row_id, column_id);
                
                // Check form of group
                if ((component.max[0] - component.min[0] + 1) * (component.max[1] - component.min[1] + 1) != component.component_size)
                    return false;

                // Check that some id is sepparated form other i.e. can't form one component with same id
                if (processed_ids.includes(component.component_id))
                    return false;

                processed_ids.push(component.component_id);
            }
        
        // Check if all cells have been processed
        for (let row_id = 0; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id)
                if (!checked[row_id][column_id])
                    return false;

        return true;
    }

    // Function that prepares data based on input matrix
    _prepare_data() {
        // Helpfull class for proparly set splitter ids
        class SplitterValue {
            constructor(start, step) {
                this.curent = start;
                this.step = step;
                this.used = false;
            }

            get() {
                this.used = true;
                return this.curent;
            }

            next() {
                if (this.used) {
                    this.curent += this.step;
                    this.used = false;
                }
            }
        }

        // Matrix for storing current grid cell sizes
        this.cell_sizes = [];
        for (let row_id = 0; row_id < this.height; ++row_id) {
            this.cell_sizes.push([]);
            for (let column_id = 0; column_id < this.width; ++column_id)
                this.cell_sizes[row_id].push([-1, -1]);
        }

        var vertical_splitter_value = new SplitterValue(VERTICAL_SPLITTER_START_ID, -2);
        var horizontal_splitter_value = new SplitterValue(HORIZONTAL_SPLITTER_START_ID, -2);
        var vertical_splitter_column_ids = [];
        // Insert columns for splitters
        for (let column_id = 1; column_id < this.width; ++column_id)
            for (let row_id = 0; row_id < this.height; ++row_id)
                if (this.grid_matrix[row_id][column_id - 1] != this.grid_matrix[row_id][column_id]) {
                    ++this.width;
                    for (let i = 0; i < this.height; ++i) {
                        if (this.grid_matrix[i][column_id - 1] != this.grid_matrix[i][column_id])
                            this.grid_matrix[i].splice(column_id, 0, vertical_splitter_value.get());
                        else {
                            this.grid_matrix[i].splice(column_id, 0, this.grid_matrix[i][column_id]);
                            vertical_splitter_value.next();
                        }
                        this.cell_sizes[i].splice(column_id, 0, [this.splitter_thickness, -1]);
                    }
                    vertical_splitter_value.next();
                    vertical_splitter_column_ids.push(column_id);
                    ++column_id;
                    break;
                }

        // Insert rows for splitters
        var horizontal_splitter_column_ids = [];
        for (let row_id = 1; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id)
                if (this.grid_matrix[row_id - 1][column_id] != this.grid_matrix[row_id][column_id]) {
                    var new_row = [];
                    this.cell_sizes.splice(row_id, 0, []);
                    for (let i = 0; i < this.width; ++i) {
                        if (i > 0 && 
                            this.grid_matrix[row_id - 1][i] != this.grid_matrix[row_id - 1][i - 1] &&
                            this.grid_matrix[row_id][i] != this.grid_matrix[row_id][i - 1])
                            horizontal_splitter_value.next();
                        if (this.grid_matrix[row_id - 1][i] != this.grid_matrix[row_id][i]) {
                            if (this.grid_matrix[row_id][i] < 0)
                                new_row.push(-1);
                            else
                                new_row.push(horizontal_splitter_value.get());
                        }
                        else {
                            new_row.push(this.grid_matrix[row_id][i]);
                            horizontal_splitter_value.next();
                        }
                        if (vertical_splitter_column_ids.includes(i))
                            this.cell_sizes[row_id].push([this.splitter_thickness, this.splitter_thickness]);
                        else
                            this.cell_sizes[row_id].push([-1, this.splitter_thickness]);
                    }
                    this.grid_matrix.splice(row_id, 0, new_row);
                    ++this.height;
                    horizontal_splitter_column_ids.push(row_id);
                    ++row_id;
                    horizontal_splitter_value.next();
                    break;
                }

        // Determine and set cell sizes based on whole grid size and splitter thickness
        const cell_width = (this.grid_width - (this.width - this.cells_width) * this.splitter_thickness) / this.cells_width;
        const cell_height = (this.grid_height - (this.height - this.cells_height) * this.splitter_thickness) / this.cells_height;
        for (let row_id = 0; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id) {
                if (this.cell_sizes[row_id][column_id][0] == -1)
                    this.cell_sizes[row_id][column_id][0] = cell_width;
                if (this.cell_sizes[row_id][column_id][1] == -1)
                    this.cell_sizes[row_id][column_id][1] = cell_height;
            }

        // Find neighbor components for each splitter
        this.splitters_neighbors = {};
        // Process neighbors search for vertical splitters
        for (let i = 0; i < vertical_splitter_column_ids.length; ++i) {
            const column_id = vertical_splitter_column_ids[i];
            let curr_splitter_id = SPACE_CELL_ID;
            for (let row_id = 0; row_id < this.height; ++row_id) {
                if (this.grid_matrix[row_id][column_id] < 0 && 
                    (curr_splitter_id == SPACE_CELL_ID || this.grid_matrix[row_id][column_id] != curr_splitter_id)) {
                        curr_splitter_id = this.grid_matrix[row_id][column_id];
                        this.splitters_neighbors[curr_splitter_id] = {};
                        this.splitters_neighbors[curr_splitter_id].left = new Set();
                        this.splitters_neighbors[curr_splitter_id].right = new Set();
                }
                if (this.grid_matrix[row_id][column_id] < 0) {
                    this.splitters_neighbors[curr_splitter_id].left.add(this.grid_matrix[row_id][column_id - 1]);
                    this.splitters_neighbors[curr_splitter_id].right.add(this.grid_matrix[row_id][column_id + 1]);
                }
            }
        }

        // Process neighbors search for horizontal splitters
        for (let i = 0; i < horizontal_splitter_column_ids.length; ++i) {
            const row_id = horizontal_splitter_column_ids[i];
            let curr_splitter_id = SPACE_CELL_ID;
            for (let column_id = 0; column_id < this.width; ++column_id) {
                // Skip vertical splitter ids
                if (Math.abs(this.grid_matrix[row_id][column_id] % 2) == 1 && this.grid_matrix[row_id][column_id] <= SPLITTERS_START_ID)
                    continue;
                if (this.grid_matrix[row_id][column_id] < 0 && 
                    (curr_splitter_id == SPACE_CELL_ID || this.grid_matrix[row_id][column_id] != curr_splitter_id)) {
                        curr_splitter_id = this.grid_matrix[row_id][column_id];
                        this.splitters_neighbors[curr_splitter_id] = {};
                        this.splitters_neighbors[curr_splitter_id].left = new Set();
                        this.splitters_neighbors[curr_splitter_id].right = new Set();
                }
                if (this.grid_matrix[row_id][column_id] <= SPLITTERS_START_ID) {
                    this.splitters_neighbors[curr_splitter_id].left.add(this.grid_matrix[row_id - 1][column_id]);
                    this.splitters_neighbors[curr_splitter_id].right.add(this.grid_matrix[row_id + 1][column_id]);
                }
            }
        }

        // Find components information
        var checked = [];
        for (let row_id = 0; row_id < this.height; ++row_id) {
            checked.push([]);
            for (let column_id = 0; column_id < this.width; ++column_id)
                checked[row_id].push(false);
        }
        this.grouped_content = {};
        for (let row_id = 0; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id) {
                if (checked[row_id][column_id])
                    continue;
                
                var component = this._find_cell_component(checked, row_id, column_id);
                this.grouped_content[component.component_id] = component;
            }
    }

    _update_cell_positions() {
        // Determine cell positions
        this.cell_positions = []; // (this.height + 1) * (this.with + 1)
        for (let row_id = 0; row_id <= this.height; ++row_id) {
            this.cell_positions.push([]);
            for (let column_id = 0; column_id <= this.width; ++column_id)
            this.cell_positions[row_id].push([0, 0]);
        }
        // Fill top and left borders respectively
        for (let j = 1; j <= this.width; ++j)
            this.cell_positions[0][j][0] = this.cell_positions[0][j - 1][0] + this.cell_sizes[0][j - 1][0];
        for (let i = 1; i <= this.height; ++i)
            this.cell_positions[i][0][1] = this.cell_positions[i - 1][0][1] + this.cell_sizes[i - 1][0][1];

        // Fill main matrix part
        for (let row_id = 1; row_id < this.height; ++row_id)
            for (let column_id = 1; column_id < this.width; ++column_id) {
                this.cell_positions[row_id][column_id][0] = this.cell_positions[row_id][column_id - 1][0] + this.cell_sizes[row_id][column_id - 1][0];
                this.cell_positions[row_id][column_id][1] = this.cell_positions[row_id - 1][column_id][1] + this.cell_sizes[row_id - 1][column_id][1];
            }

        // Fill right and bottom borders respectively
        for (let i = 0; i < this.height; ++i) {
            this.cell_positions[i][this.width][0] = this.cell_positions[i][this.width - 1][0] + this.cell_sizes[i][this.width - 1][0];
            this.cell_positions[i][this.width][1] = this.cell_positions[i][this.width - 1][1];
        }
        for (let j = 0; j < this.width; ++j) {
            this.cell_positions[this.height][j][0] = this.cell_positions[this.height - 1][j][0];
            this.cell_positions[this.height][j][1] = this.cell_positions[this.height - 1][j][1] + this.cell_sizes[this.height - 1][j][1];
        }
    }

    // Updates component element's styles i.e. positions and sizes
    _update_components() {
        for (const [component_id, component] of Object.entries(this.grouped_content)) {
            const min = component.min;
            const max = component.max;
            const element_pos = this.cell_positions[min[0]][min[1]];
            const element_size = [
                this.cell_positions[max[0]][max[1] + 1][0] - this.cell_positions[min[0]][min[1]][0], 
                this.cell_positions[max[0] + 1][max[1]][1] - this.cell_positions[min[0]][min[1]][1]
            ];

            if (component_id == SPACE_CELL_ID)
                continue;

            if (component_id <= SPLITTERS_START_ID){
                var curr_splitter = this.grid_splitters[-component_id + SPLITTERS_START_ID];
                switch (curr_splitter.orientation) {
                    case SplitterOrientation.Horizontal:
                        curr_splitter.set_position(element_pos);
                        curr_splitter.set_length(element_size[0]);
                        break;
                    case SplitterOrientation.Vertical:
                        curr_splitter.set_position(element_pos);
                        curr_splitter.set_length(element_size[1]);
                        break;
                }
            }
            else {
                var curr_cell_element = this.grid_components[component_id];
                curr_cell_element.style.width = element_size[0] + "px";
                curr_cell_element.style.height = element_size[1] + "px";
                curr_cell_element.style.left = element_pos[0] + "px";
                curr_cell_element.style.top = element_pos[1] + "px";
            }
        }
    }

    // Extract component from matrix starting from input cell
    _find_cell_component(check_matrix, row_id, column_id) {
        var queue = [[row_id, column_id]];
        var component_id = this.grid_matrix[row_id][column_id];
        var min = [row_id, column_id];
        var max = [row_id, column_id];
        var elements_cnt = 0;
        while (queue.length > 0) {
            var curr_element_id = queue.shift();

            if (curr_element_id[0] < 0 || curr_element_id[1] < 0 ||
                curr_element_id[0] >= this.height || curr_element_id[1] >= this.width)
                continue;

            if (check_matrix[curr_element_id[0]][curr_element_id[1]])
                continue;

            var curr_element = this.grid_matrix[curr_element_id[0]][curr_element_id[1]];

            if (curr_element == component_id) {
                check_matrix[curr_element_id[0]][curr_element_id[1]] = true;

                min[0] = Math.min(min[0], curr_element_id[0]);
                min[1] = Math.min(min[1], curr_element_id[1]);
                max[0] = Math.max(max[0], curr_element_id[0]);
                max[1] = Math.max(max[1], curr_element_id[1]);

                queue.push([curr_element_id[0] - 1, curr_element_id[1]]);
                queue.push([curr_element_id[0] + 1, curr_element_id[1]]);
                queue.push([curr_element_id[0], curr_element_id[1] - 1]);
                queue.push([curr_element_id[0], curr_element_id[1] + 1]);

                ++elements_cnt;
            }
        }
        return {component_id : component_id, min : min, max : max, component_size : elements_cnt};
    }

    _init() {
        this.element = document.createElement("div");
        this.element.classList.add("grid-container");

        this.grid_components = [];
        this.grid_splitters = [];

        // Find max ids for cells and splitters
        var cells_last = 0;
        var splitters_last = 0;
        for (let row_id = 0 ; row_id < this.height; ++row_id)
            for (let column_id = 0; column_id < this.width; ++column_id) {
                cells_last = Math.max(cells_last, this.grid_matrix[row_id][column_id]);
                splitters_last = Math.min(splitters_last, this.grid_matrix[row_id][column_id]);
            }
        
        // Fill up cells array
        // Cells marked in matrix started from 0, so count will be cells_last + 1
        for (let component_id = 0; component_id <= cells_last; ++component_id) {
            var component_element = document.createElement("div");
            component_element.classList.add("grid-cell");
            component_element.id = GRID_CELL_ELEMENT_ID_PREFIX + component_id;
            this.element.appendChild(component_element);
            this.grid_components.push(component_element);
        }

        // Fill up splitters array
        var self = this;
        for (let splitter_id = -2; splitter_id >= splitters_last; --splitter_id) {
            const orientation = Math.abs(splitter_id % 2) == 1 ? SplitterOrientation.Vertical : SplitterOrientation.Horizontal;
            var splitter = new Splitter(orientation, this.splitter_thickness, splitter_id);
            
            splitter.onmove = function (delta) {
                const neighbors = self.splitters_neighbors[splitter_id];
                const all_neighbors = new Set([...neighbors.left, ...neighbors.right]);
                for (const neighbor_id of all_neighbors) {
                    const component = self.grouped_content[neighbor_id];

                    var splitter_rows_cnt = 0;
                    var splitter_cols_cnt = 0;
                    for (let component_row_id = component.min[0]; component_row_id <= component.max[0]; ++component_row_id)
                        for (let component_col_id = component.min[1]; component_col_id <= component.max[1]; ++component_col_id) {
                            if (self.cell_sizes[component_row_id][component_col_id][0] == self.splitter_thickness)
                                ++splitter_cols_cnt;
                            if (self.cell_sizes[component_row_id][component_col_id][1] == self.splitter_thickness)
                                ++splitter_rows_cnt;
                        }
                    
                    const max = component.max;
                    const min = component.min;
                    const component_rows = max[0] - min[0] + 1;
                    const component_cols = max[1] - min[1] + 1;
                    const old_component_size = [
                        self.cell_positions[max[0]][max[1] + 1][0] - self.cell_positions[min[0]][min[1]][0], 
                        self.cell_positions[max[0] + 1][max[1]][1] - self.cell_positions[min[0]][min[1]][1]
                    ];
                    const is_left = neighbors.left.has(neighbor_id);
                    const new_component_size = [
                        old_component_size[0] + (is_left ? -delta[0] : delta[0]),
                        old_component_size[1] + (is_left ? -delta[1] : delta[1])];
                    const new_cell_height = (new_component_size[1] - splitter_rows_cnt * self.splitter_thickness) / (component_rows - splitter_rows_cnt);
                    const new_cell_width = (new_component_size[0] - splitter_cols_cnt * self.splitter_thickness) / (component_cols - splitter_cols_cnt);
                    for (let component_row_id = min[0]; component_row_id <= max[0]; ++component_row_id)
                        for (let component_col_id = min[1]; component_col_id <= max[1]; ++component_col_id) {
                            if (self.cell_sizes[component_row_id][component_col_id][0] != self.splitter_thickness)
                                self.cell_sizes[component_row_id][component_col_id][0] = new_cell_width;
                            if (self.cell_sizes[component_row_id][component_col_id][1] != self.splitter_thickness)
                                self.cell_sizes[component_row_id][component_col_id][1] = new_cell_height;
                        }
                }
                self._update_cell_positions();
                self._update_components();
            }

            this.grid_splitters.push(splitter);
            this.element.appendChild(splitter.element);
        }

        this._update_cell_positions();
        this._update_components();
    }
}