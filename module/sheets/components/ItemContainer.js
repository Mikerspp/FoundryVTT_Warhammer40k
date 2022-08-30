import ExtensibleTable from './ExtensibleTable.js';

/**
 * Class ItemContainer
 * @ignore
 */
class ItemContainer extends ExtensibleTable {
    /**
     * Table header should be displayed
     * @type {boolean}
     * @private
     */
    _headDisplay;

    /**
     * Which templates can be displayed
     * @type {Array<String>}
     * @private
     */
    _templateFilter;

    /**
     * Additional filters to apply on items
     * @type {Array<Object>}
     * @private
     */
    _itemFilter;

    /**
     * Show delete button
     * @type {Boolean}
     * @private
     */
    _showDelete;

    /**
     * Alignment of the item reference column
     * @type {String}
     * @private
     */
    _nameAlign;

    /**
     * Label of the item reference column
     * @type {String}
     * @private
     */
    _nameLabel;

    /**
     * ItemContainer constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {boolean} [data.headDisplay=true] Table header should be displayed
     * @param {boolean} [data.head=false] Table header should be bold
     * @param {boolean} [data.deleteWarning=false] Display warning on item delete
     * @param {boolean} [data.showDelete=true] Display delete button
     * @param {String} [data.nameAlign=null] Alignment of the item reference column
     * @param {String} [data.nameLabel='Name'] Label of the item reference column
     * @param {Array<String>} [data.templateFilter=[]] Which templates can be displayed
     * @param {Array<Object>} [data.itemFilter=[]] Additional filters to apply on items
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        head = false,
        headDisplay = true,
        deleteWarning = false,
        showDelete = true,
        nameAlign = null,
        nameLabel = 'Name',
        templateFilter = [],
        itemFilter = [],
        contents = [],
        rowLayout = {},
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            cssClass: cssClass,
            contents: contents,
            rowLayout: rowLayout,
            head: head,
            deleteWarning: deleteWarning,
            role: role,
            permission: permission
        });

        this._headDisplay = headDisplay;
        this._templateFilter = templateFilter;
        this._itemFilter = itemFilter;
        this._showDelete = showDelete;
        this._nameAlign = nameAlign;
        this._nameLabel = nameLabel;
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor Rendered actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = await super._getElement(actor, isEditable, options);

        let relevantItems = actor.items.filter((item) => {
            let isValid = item.type === 'equippableItem' && this._templateFilter.includes(item.data.data.template);

            if (isValid) {
                for (let filter of this._itemFilter) {
                    switch (filter.operator) {
                        case 'gt':
                            isValid = isValid && item.data.data.props[filter.prop] > filter.value;
                            break;
                        case 'geq':
                            isValid = isValid && item.data.data.props[filter.prop] >= filter.value;
                            break;
                        case 'lt':
                            isValid = isValid && item.data.data.props[filter.prop] < filter.value;
                            break;
                        case 'leq':
                            isValid = isValid && item.data.data.props[filter.prop] <= filter.value;
                            break;
                        case 'eq':
                        default:
                            isValid = isValid && String(item.data.data.props[filter.prop]) === filter.value;
                            break;
                    }
                }
            }

            return isValid;
        });

        if (!this._headDisplay && !this._showDelete && this.contents.length === 0 && !actor.isTemplate) {
            jQElement.addClass('flexcol flex-group-no-stretch');

            switch (this._nameAlign) {
                case 'center':
                    jQElement.addClass('flex-group-center');
                    break;
                case 'right':
                    jQElement.addClass('flex-group-right');
                    break;
                case 'left':
                default:
                    jQElement.addClass('flex-group-left');
                    break;
            }

            for (let item of relevantItems) {
                let itemLink = $('<a></a>');
                itemLink.addClass('entity-link');
                itemLink.attr({ 'data-type': 'Item', 'data-entity': 'Item', 'data-id': item.id });
                itemLink.append('<i class="fas fa-suitcase" style="margin-right:5px;"></i>');
                itemLink.append(item.name);

                itemLink.on('click', () => {
                    item.sheet.render(true);
                });

                jQElement.append(itemLink);
            }
        } else {
            let tableElement = $('<table></table>');

            let tableBody = $('<tbody></tbody>');

            if (this._headDisplay || actor.isTemplate) {
                let firstRow = $('<tr></tr>');

                if (!this._headDisplay) {
                    firstRow.addClass('custom-system-hidden-row');
                }

                let cell = $('<td></td>');
                cell.addClass('custom-system-cell custom-system-cell-alignCenter');

                if (this._head) {
                    cell.addClass('custom-system-cell-boldTitle');
                }

                switch (this._nameAlign) {
                    case 'center':
                        cell.addClass('custom-system-cell-alignCenter');
                        break;
                    case 'right':
                        cell.addClass('custom-system-cell-alignRight');
                        break;
                    case 'left':
                    default:
                        cell.addClass('custom-system-cell-alignLeft');
                        break;
                }

                cell.text(this._nameLabel);
                firstRow.append(cell);

                for (let component of this.contents) {
                    let cell = $('<td></td>');
                    cell.addClass('custom-system-cell');

                    switch (this._rowLayout[component.key].align) {
                        case 'center':
                            cell.addClass('custom-system-cell-alignCenter');
                            break;
                        case 'right':
                            cell.addClass('custom-system-cell-alignRight');
                            break;
                        case 'left':
                        default:
                            cell.addClass('custom-system-cell-alignLeft');
                            break;
                    }

                    if (this._head) {
                        cell.addClass('custom-system-cell-boldTitle');
                    }

                    cell.append(this._rowLayout[component.key].colName);

                    if (actor.isTemplate) {
                        cell.addClass('custom-system-editable-component');
                        cell.append(' {' + component.key + '}');
                        cell.on('click', () => {
                            component.editComponent(actor, this._rowLayout[component.key], ['Label']);
                        });
                    }

                    firstRow.append(cell);
                }

                if (this._showDelete || actor.isTemplate) {
                    let headControlsCell = $('<td></td>');

                    if (actor.isTemplate) {
                        headControlsCell.addClass('custom-system-cell custom-system-cell-alignRight');
                        headControlsCell.append(
                            await this.renderTemplateControls(actor, { allowedComponents: ['Label'] })
                        );
                    }

                    firstRow.append(headControlsCell);
                }

                tableBody.append(firstRow);
            }

            for (let item of relevantItems) {
                let tableRow = $('<tr></tr>');
                tableRow.addClass('custom-system-dynamicRow');

                let tableCell = $('<td></td>');
                tableCell.addClass('custom-system-cell');

                switch (this._nameAlign) {
                    case 'center':
                        tableCell.addClass('custom-system-cell-alignCenter');
                        break;
                    case 'right':
                        tableCell.addClass('custom-system-cell-alignRight');
                        break;
                    case 'left':
                    default:
                        tableCell.addClass('custom-system-cell-alignLeft');
                        break;
                }

                let itemLink = $('<a></a>');
                itemLink.addClass('entity-link');
                itemLink.attr({ 'data-type': 'Item', 'data-entity': 'Item', 'data-id': item.id });
                itemLink.append('<i class="fas fa-suitcase" style="margin-right:5px;"></i>');
                itemLink.append(item.name);

                itemLink.on('click', () => {
                    item.sheet.render(true);
                });

                tableCell.append(itemLink);

                tableRow.append(tableCell);

                for (let component of this.contents) {
                    let cell = $('<td></td>');
                    cell.addClass('custom-system-cell');

                    switch (this._rowLayout[component.key].align) {
                        case 'center':
                            cell.addClass('custom-system-cell-alignCenter');
                            break;
                        case 'right':
                            cell.addClass('custom-system-cell-alignRight');
                            break;
                        case 'left':
                        default:
                            cell.addClass('custom-system-cell-alignLeft');
                            break;
                    }

                    let newCompJson = component.toJSON();
                    newCompJson.key = '';

                    let itemProps = item.data.data.props;
                    itemProps.name = item.name;

                    cell.append(
                        await componentFactory
                            .createComponents(newCompJson)
                            .render(actor, isEditable, { customProps: { item: itemProps } })
                    );

                    tableRow.append(cell);
                }

                if (this._showDelete) {
                    let controlCell = $('<td></td>');
                    let controlDiv = $('<div></div>');
                    controlDiv.addClass('custom-system-dynamic-table-row-icons');

                    if (isEditable) {
                        let deleteLink = $(
                            '<a><i class="fas fa-trash custom-system-deleteDynamicLine custom-system-clickable"></i></a>'
                        );
                        if (this._deleteWarning) {
                            deleteLink.on('click', () => {
                                Dialog.confirm({
                                    title: 'Delete item',
                                    content: '<p>Are you sure you want to delete this item ?</p>',
                                    yes: () => {
                                        actor.deleteEmbeddedDocuments('Item', [item.id]);
                                        actor.sheet.render(false);
                                    },
                                    no: () => {}
                                });
                            });
                        } else {
                            deleteLink.on('click', () => {
                                actor.deleteEmbeddedDocuments('Item', [item.id]);
                                actor.sheet.render(false);
                            });
                        }
                        controlDiv.append(deleteLink);
                    }
                    controlCell.append(controlDiv);
                    tableRow.append(controlCell);
                }

                tableBody.append(tableRow);
            }

            tableElement.append(tableBody);
            jQElement.append(tableElement);
        }

        if (actor.isTemplate) {
            let templateWrapper = $('<div></div>');
            templateWrapper.addClass('custom-system-editable-panel');

            let panelTitle = $('<div></div>');
            panelTitle.addClass('custom-system-editable-panel-title custom-system-editable-component');
            panelTitle.text('Item Container ' + this.key);

            panelTitle.on('click', () => {
                this.editComponent(actor);
            });

            templateWrapper.append(panelTitle);

            templateWrapper.append(jQElement);

            jQElement = templateWrapper;
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
            head: this._head,
            headDisplay: this._headDisplay,
            deleteWarning: this._deleteWarning,
            showDelete: this._showDelete,
            nameAlign: this._nameAlign,
            nameLabel: this._nameLabel,
            templateFilter: this._templateFilter,
            itemFilter: this._itemFilter,
            type: 'itemContainer'
        };
    }

    /**
     * Creates checkbox from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {ItemContainer}
     */
    static fromJSON(json, templateAddress) {
        let rowContents = [];
        let rowLayout = {};

        for (let [index, componentDesc] of (json.rowLayout ?? []).entries()) {
            let component = componentFactory.createComponents(componentDesc, templateAddress + '.rowLayout.' + index);
            rowContents.push(component);
            rowLayout[component.key] = {
                align: componentDesc.align,
                colName: componentDesc.colName
            };
        }

        return new ItemContainer({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            cssClass: json.cssClass,
            head: json.head,
            headDisplay: json.headDisplay,
            showDelete: json.showDelete,
            deleteWarning: json.deleteWarning,
            nameAlign: json.nameAlign,
            nameLabel: json.nameLabel,
            templateFilter: json.templateFilter,
            itemFilter: json.itemFilter,
            contents: rowContents,
            rowLayout: rowLayout,
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
        return 'Item Container';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        if (!existingComponent) {
            existingComponent = {};
        }

        if (existingComponent.headDisplay === undefined) {
            existingComponent.headDisplay = true;
        }

        if (existingComponent.showDelete === undefined) {
            existingComponent.showDelete = true;
        }

        if (existingComponent.nameLabel === undefined) {
            existingComponent.nameLabel = 'Name';
        }

        existingComponent.availableTemplates = game.items
            .filter((item) => item.data.type === '_equippableItemTemplate')
            .map((template) => {
                return {
                    id: template.id,
                    name: template.name,
                    checked: existingComponent.templateFilter
                        ? existingComponent.templateFilter.includes(template.id)
                        : true
                };
            });

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/itemContainer.html',
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
        let fieldData = super.extractConfig(html);

        fieldData.headDisplay = html.find('#itemHeadDisplay').is(':checked');
        fieldData.head = html.find('#itemHead').is(':checked');
        fieldData.showDelete = html.find('#itemShowDelete').is(':checked');
        fieldData.deleteWarning = html.find('#itemDeleteWarning').is(':checked');
        fieldData.nameAlign = html.find('#itemNameAlign').val();
        fieldData.nameLabel = html.find('#itemNameLabel').val();

        fieldData.templateFilter = html
            .find('input[name=itemFilterTemplate]:checked')
            .map(function () {
                return $(this).val();
            })
            .get();

        let itemFilter = [];

        html.find('tr.CSB-itemFilter').each((index, elt) => {
            let prop = $(elt).find('input[name=itemFilterProp]').val();
            let operator = $(elt).find('select[name=itemFilterOp]').val();
            let value = $(elt).find('input[name=itemFilterValue]').val();

            if (!prop) {
                throw new Error('All filters must be based on a property');
            }

            if (!value) {
                throw new Error('All filters must be compared to a value');
            }

            itemFilter.push({
                prop: prop,
                operator: operator,
                value: value
            });
        });

        fieldData.itemFilter = itemFilter;

        return fieldData;
    }
}

/**
 * @ignore
 */
export default ItemContainer;
