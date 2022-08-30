import Container from './Container.js';
import Tab from './Tab.js';
import templateFunctions from '../template-functions.js';

/**
 * Tabbed Panel component
 * @ignore
 */
class TabbedPanel extends Container {
    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {Array<Component>} [data.contents=[]] Container contents
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({ key, tooltip = null, templateAddress, contents = [], cssClass = null, role = 0, permission = 0 }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            contents: contents,
            cssClass: cssClass,
            role: role,
            permission: permission
        });
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let activeKey = null;

        try {
            activeKey = game.user.getFlag(
                'custom-system-builder',
                actor.id + '.' + this.templateAddress + '.activeTab'
            );
        } catch (e) {}

        if (this.contents.filter((tab) => tab.key === activeKey).length === 0) {
            activeKey = this.contents?.[0]?.key;
        }

        // Generating content
        let tabSection = $('<section></section>');
        let tabsContent = {};

        for (let tab of this.contents) {
            tabsContent[tab.key] = await tab.render(actor, isEditable);
            tabSection.append(tabsContent[tab.key]);
        }

        // Generating nav
        let tabNav = $('<nav></nav>');
        let tabsLink = {};

        tabNav.addClass('sheet-tabs tabs');

        for (let tab of this.contents) {
            if (tab.canBeRendered(actor)) {
                let tabSpan = $('<span></span>');
                if (tab.tooltip) {
                    tabSpan.attr('title', tab.tooltip);
                }

                let tabLink = $('<a></a>');
                tabLink.addClass('item');
                tabLink.text(tab.name);

                tabLink.on('click', () => {
                    tabsContent[activeKey].removeClass('active');
                    tabsContent[tab.key].addClass('active');

                    tabsLink[activeKey].removeClass('active');
                    tabLink.addClass('active');

                    game.user.setFlag(
                        'custom-system-builder',
                        actor.id + '.' + this.templateAddress + '.activeTab',
                        tab.key
                    );
                    activeKey = tab.key;
                });

                tabsLink[tab.key] = tabLink;

                if (actor.isTemplate) {
                    let sortLeftTabButton = $('<a><i class="fas fa-caret-left custom-system-clickable"></i></a>');
                    sortLeftTabButton.addClass('item');
                    sortLeftTabButton.attr('title', 'Sort tab tot the left');

                    sortLeftTabButton.on('click', () => {
                        tab.sortUpInParent(actor);
                    });

                    tabSpan.append(sortLeftTabButton);
                }

                tabSpan.append(tabLink);

                if (actor.isTemplate) {
                    let sortRightTabButton = $('<a><i class="fas fa-caret-right custom-system-clickable"></i></a>');
                    sortRightTabButton.addClass('item');
                    sortRightTabButton.attr('title', 'Sort tab to the right');

                    sortRightTabButton.on('click', () => {
                        tab.sortDownInParent(actor);
                    });

                    tabSpan.append(sortRightTabButton);
                }

                tabNav.append(tabSpan);
            }
        }

        if (actor.isTemplate) {
            let controlSpan = $('<span></span>');

            let addTabButton = $('<a><i class="fas fa-plus-circle custom-system-clickable"></i></a>');
            addTabButton.addClass('item');
            addTabButton.attr('title', 'Add new tab');

            addTabButton.on('click', () => {
                // Create dialog for tab edition
                templateFunctions.editTab(({ name, key, role = 0, permission = 0, tooltip = null }) => {
                    // This is called on dialog validation

                    // Checking for duplicate keys
                    let existingTab = this.contents.filter((tab) => tab.key === key);

                    if (existingTab.length > 0) {
                        ui.notifications.error('Could not create tab with duplicate key ' + key);
                    } else {
                        // Adding the new tab to the template
                        this.contents.push(
                            Tab.fromJSON(
                                {
                                    name: name,
                                    key: key,
                                    role: role,
                                    permission: permission,
                                    tooltip: tooltip,
                                    contents: []
                                },
                                this.templateAddress + '.contents.' + this.contents.length
                            )
                        );
                        foundry.utils.setProperty(actor.data.data, this.templateAddress, this.toJSON());

                        this.save(actor);
                    }
                });
            });

            let editTabButton = $('<a><i class="fas fa-edit custom-system-clickable"></i></a>');
            editTabButton.addClass('item');
            editTabButton.attr('title', 'Edit current tab');

            editTabButton.on('click', () => {
                let tab = this.contents.filter((tab) => tab.key === activeKey)[0];
                // Create dialog for tab edition
                templateFunctions.editTab(({ name, key, role = 0, permission = 0, tooltip = null }) => {
                    // This is called on dialog validation

                    // Checking for duplicate keys
                    let existingTab = this.contents.filter((tab) => tab.key === key);

                    if (existingTab.length > 0 && key !== activeKey) {
                        ui.notifications.error('Could not edit tab with duplicate key ' + key);
                    } else {
                        // Updating tab data
                        tab.edit(actor, {
                            name: name,
                            tooltip: tooltip,
                            key: key,
                            role: role,
                            permission: permission
                        });
                    }
                }, tab.toJSON());
            });

            let deleteTabButton = $('<a><i class="fas fa-trash custom-system-clickable"></i></a>');
            deleteTabButton.addClass('item');
            deleteTabButton.attr('title', 'Delete current tab');

            deleteTabButton.on('click', () => {
                this.contents.filter((tab) => tab.key === activeKey)[0].delete(actor);
            });

            controlSpan.append(addTabButton);
            controlSpan.append(editTabButton);
            controlSpan.append(deleteTabButton);

            tabNav.append(controlSpan);
        }

        let jQElement = await super._getElement(actor, isEditable, options);

        jQElement.append(tabNav);
        jQElement.append(tabSection);

        if (actor.isTemplate) {
            let templateWrapper = $('<div></div>');
            templateWrapper.addClass('custom-system-editable-panel');

            let panelTitle = $('<div></div>');
            panelTitle.addClass('custom-system-editable-panel-title custom-system-editable-component');
            panelTitle.text('Tabbed Panel ' + this.key);

            panelTitle.on('click', () => {
                this.editComponent(actor);
            });

            templateWrapper.append(panelTitle);
            templateWrapper.append(jQElement);

            jQElement = templateWrapper;
        }

        if (activeKey) {
            tabsContent[activeKey].addClass('active');
            tabsLink[activeKey].addClass('active');
        }

        return jQElement;
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        return {
            ...jsonObj,
            type: 'tabbedPanel'
        };
    }

    /**
     * Creates Tabbed Panel from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {TabbedPanel}
     */
    static fromJSON(json, templateAddress) {
        let contents = [];
        for (let [index, tabData] of json?.contents?.entries() ?? []) {
            contents.push(Tab.fromJSON(tabData, templateAddress + '.contents.' + index));
        }

        return new TabbedPanel({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            contents: contents,
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission
        });
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Tabbed Panel';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/tabbed-panel.html',
                existingComponent
            )
        );

        return mainElt;
    }

    /**
     * Extracts configuration from submitted HTML form
     * @override
     * @param {JQuery<HTMLElement>} html The submitted form
     * @return {Object} The JSON representation of the component
     * @throws {Error} If configuration is not correct
     */
    static extractConfig(html) {
        return super.extractConfig(html);
    }
}

/**
 * @ignore
 */
export default TabbedPanel;
