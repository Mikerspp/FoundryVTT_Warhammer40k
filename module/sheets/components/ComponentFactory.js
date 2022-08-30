/**
 * Component factory. Used to create components from JSON.
 * This is a singleton object exported globally
 */
class ComponentFactory {
    _componentTypes = {};

    /**
     * Returns currently registered component types
     * @return {Array<String>}
     */
    get componentTypes() {
        return Object.keys(this._componentTypes);
    }

    /**
     * Creates an array of components from an array of JSON-described components
     * @param {Array<{}>|{}} [json=[]] The JSON description of the components.
     * @param {string} [templateAddress=''] The base address of the components. The array index is appended to the address if json is an array.
     * @return {Array<Component>|Component} An array of components or one component if json is not an Array
     */
    createComponents(json = [], templateAddress = '') {
        if (Array.isArray(json)) {
            let contents = [];

            for (let [index, component] of json.entries()) {
                contents.push(this._createOneComponent(component, templateAddress + '.' + index));
            }

            return contents;
        } else {
            return this._createOneComponent(json, templateAddress);
        }
    }

    /**
     * Creates one component from a JSON description
     * @param json
     * @param templateAddress
     * @returns {null|*}
     * @private
     */
    _createOneComponent(json, templateAddress) {
        let component;

        if (json === null) {
            return null;
        }

        if (this._componentTypes[json.type]) {
            component = this._componentTypes[json.type].fromJSON(json, templateAddress);
        } else {
            throw new Error('Unrecognized component type ' + json.type);
        }

        return component;
    }

    /**
     * Adds a component type from a name and an ES6 Class
     * @param {string} name Component name
     * @param {Class<Component>} cls The component's class, inheriting Component
     */
    addComponentType(name, cls) {
        this._componentTypes[name] = cls;
    }

    /**
     * Returns a registered component's class
     * @param {string} name The component class name
     * @return {Class<Component>} The component class
     * @throws {Error} If the name does not match a registered Component Class
     */
    getComponentClass(name) {
        if (this._componentTypes[name]) {
            return this._componentTypes[name];
        } else {
            throw new Error('Unrecognized component class name ' + name);
        }
    }
}

globalThis.componentFactory = new ComponentFactory();
