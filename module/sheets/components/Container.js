import Component from './Component.js';
import templateFunctions from '../template-functions.js';

/**
 * Abstract container class
 * @abstract
 */
class Container extends Component {
    /**
     * Container contents
     * @type {Array<Component>}
     * @private
     */
    _contents;

    /**
     * Can container accept dropped subtemplates ?
     * @type {boolean}
     * @private
     */
    _droppable;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {Array<Component>} [data.contents=[]] Container contents
     * @param {boolean} [data.droppable=false] Can container accept dropped subtemplates ?
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        contents = [],
        droppable = false,
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            cssClass: cssClass,
            role: role,
            permission: permission
        });

        if (this.constructor === Container) {
            throw new TypeError('Abstract class "Container" cannot be instantiated directly');
        }

        this._contents = contents;
        this._droppable = droppable;
    }

    /**
     * Container contents
     * @return {Array<Component>}
     */
    get contents() {
        return this._contents;
    }

    /**
     * Renders contents component
     * @param {CustomActor} actor Rendered actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<Array<JQuery<HTMLElement>>>} The jQuery elements holding the components
     */
    async renderContents(actor, isEditable = true) {
        let jqElts = [];

        for (let component of this._contents) {
            jqElts.push(await component.render(actor, isEditable));
        }

        return jqElts;
    }

    /**
     * Renders template controls
     * @param {CustomActor} actor Rendered actor
     * @param {Object} options Component adding options
     * @return {Promise<Array<JQuery<HTMLElement>>>} The jQuery element holding the component
     */
    async renderTemplateControls(actor, options = {}) {
        let containerControls = $('<div></div>');
        containerControls.addClass('custom-system-template-tab-controls');

        if (this._droppable) {
            containerControls.addClass('custom-system-droppable-container');

            containerControls
                .on('dragenter', (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    containerControls.addClass('custom-system-template-dragged-over');
                })
                .on('dragover', (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    event.originalEvent.dataTransfer.effectAllowed = 'copy';
                    event.originalEvent.dataTransfer.dropEffect = 'copy';
                })
                .on('dragleave', () => {
                    containerControls.removeClass('custom-system-template-dragged-over');
                })
                .on('drop', (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    let dropData;

                    try {
                        dropData = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
                    } catch (e) {}

                    if (dropData) {
                        let item = game.items.get(dropData?.id ?? '');
                        if (item && item.type === 'subTemplate') {
                            this.addNewComponent(actor, item.data.data.body.contents, options);
                        } else {
                            ui.notifications.error('Only subtemplates items can be dragged on templates');
                        }
                    }
                });
        }

        let addElement = $('<a></a>');
        addElement.addClass('item custom-system-template-tab-controls-add-element');
        addElement.attr('title', 'Add new element');
        addElement.append('<i class="fas fa-plus-circle custom-system-clickable custom-system-add-component"></i>');

        addElement.on('click', () => {
            this.openComponentEditor(actor, options);
        });

        containerControls.append(addElement);

        return containerControls;
    }

    /**
     * Opens component editor
     * @param {CustomActor} actor Rendered actor
     * @param {Object} options Component options
     * @param {Object} [options.defaultValues] Component default values
     * @param {Array} [options.allowedComponents] Allowed components
     */
    openComponentEditor(actor, options = {}) {
        // Open dialog to edit new component
        templateFunctions.component(
            (action, component) => {
                // This is called on dialog validation
                this.addNewComponent(actor, component, options);
            },
            options.defaultValues,
            options.allowedComponents
        );
    }

    /**
     * Adds new component to container
     * @param {CustomActor} actor Rendered actor
     * @param {Object|Array<Object>} component New component
     * @param {Object} options Component options
     * @param {Object} [options.defaultValues] Component default values
     * @param {Array} [options.allowedComponents] Allowed components
     */
    addNewComponent(actor, component, options = {}) {
        if (!Array.isArray(component)) {
            component = [component];
        }

        for (let aComp of component) {
            if (actor.getKeys().has(aComp.key)) {
                throw new Error('Component keys should be unique in the template.');
            }
        }

        // Add component
        this._contents = this._contents.concat(componentFactory.createComponents(component));
        foundry.utils.setProperty(actor.data.data, this.templateAddress, this.toJSON());

        actor.update({
            data: {
                header: actor.data.data.header,
                body: actor.data.data.body
            }
        });
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();
        let contentsJSON = [];

        for (let component of this.contents) {
            // Handling Tables, which handle their contents themselves
            if (component instanceof Component) {
                contentsJSON.push(component.toJSON());
            }
        }

        return {
            ...jsonObj,
            contents: contentsJSON
        };
    }
}

/**
 * @ignore
 */
export default Container;
