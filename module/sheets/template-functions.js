let editTabDialog = null;
let componentDialog = null;
let attributesDialog = null;
let attributeBarsDialog = null;
let displaySettingsDialog = null;
let modifiersDialog = null;

/**
 * Dialog for tab creation / edition
 * @param callback The callback to call on Save click
 * @param tabData The existing Tab data, if any
 * @returns {Promise<void>}
 * @ignore
 */
const editTab = async (callback, tabData = null) => {
    let permissionList = {};
    for (let [n, l] of Object.entries(CONST.DOCUMENT_PERMISSION_LEVELS)) {
        permissionList[l] = game.i18n.localize(`PERMISSION.${n}`);
    }

    let roleList = {};
    for (let [n, l] of Object.entries(CONST.USER_ROLES)) {
        roleList[l] = game.i18n.localize(`USER.Role${n.toLowerCase().capitalize()}`);
    }

    // Render the dialog contents
    let content = await renderTemplate(`systems/custom-system-builder/templates/_template/dialogs/edit-tab.html`, {
        ...tabData,
        permissionList: permissionList,
        roleList: roleList
    });

    if (editTabDialog && editTabDialog.rendered) {
        await editTabDialog.close();
    }
    // Create the dialog
    editTabDialog = new Dialog({
        title: 'New tab',
        content: content,
        buttons: {
            validate: {
                icon: '<i class="fas fa-check"></i>',
                label: 'Save tab',
                callback: (html) => {
                    let tabData = {};
                    // Ensure name and key are entered
                    tabData.name = html.find('#tab-name').val();
                    tabData.key = html.find('#tab-key').val();
                    tabData.tooltip = html.find('#tab-tooltip').val();
                    tabData.role = html.find('#tabRole').val();
                    tabData.permission = html.find('#tabPerm').val();

                    if (!tabData.name || !tabData.key) {
                        throw new Error('Name and Key must not be empty');
                    } else {
                        callback(tabData);
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel'
            }
        },
        default: 'cancel'
    });
    editTabDialog.render(true);
};

/**
 * Dialog for component creation / edition
 * @param callback The callback to call on button click
 * @param componentData The existing component's data, if any
 * @param {Array<String>|null} allowedComponents Allowed components
 * @param {boolean} isDynamicTable Is the popup called from a dynamic table ?
 * @returns {Promise<void>}
 * @ignore
 */
const component = async (callback, componentData = null, allowedComponents = null, isDynamicTable = false) => {
    let permissionList = {};
    for (let [n, l] of Object.entries(CONST.DOCUMENT_PERMISSION_LEVELS)) {
        permissionList[l] = game.i18n.localize(`PERMISSION.${n}`);
    }

    let roleList = {};
    for (let [n, l] of Object.entries(CONST.USER_ROLES)) {
        roleList[l] = game.i18n.localize(`USER.Role${n.toLowerCase().capitalize()}`);
    }

    // Render the dialog's contents
    let content = await renderTemplate(`systems/custom-system-builder/templates/_template/dialogs/component.html`, {
        ...componentData,
        isDynamic: isDynamicTable,
        permissionList: permissionList,
        roleList: roleList
    });

    let mainDiv = $(content);
    let componentTypeSelect = mainDiv.find('#compType');

    for (let componentType of componentFactory.componentTypes) {
        let componentClass = componentFactory.getComponentClass(componentType);

        if (!allowedComponents || allowedComponents.includes(componentClass.name)) {
            let componentDiv = $('<div></div>');
            componentDiv.addClass('custom-system-component-editor custom-system-' + componentType + '-editor');

            componentDiv.append(await componentClass.getConfigForm(componentData));

            mainDiv.append(componentDiv);

            let typeOption = $('<option></option>');
            typeOption.attr('value', componentType);
            typeOption.text(componentClass.getPrettyName());

            if (componentData?.type === componentType) {
                typeOption.attr('selected', 'selected');
            }

            componentTypeSelect.append(typeOption);
        }
    }

    let editButtons = {};

    // If component data was provided, we can display the edit actions : Delete and Sort buttons
    if (componentData) {
        editButtons = {
            delete: {
                icon: '<i class="fas fa-trash"></i>',
                label: 'Delete',
                callback: () => {
                    // Just call callback with delete, and no new component data
                    callback('delete');
                }
            },
            moveBefore: {
                icon: '<i class="fas fa-caret-left"></i>',
                label: 'Move before',
                callback: () => {
                    // Just call callback with sortUp, and no new component data
                    callback('sortUp');
                }
            },
            moveAfter: {
                icon: '<i class="fas fa-caret-right"></i>',
                label: 'Move after',
                callback: () => {
                    // Just call callback with sortDown, and no new component data
                    callback('sortDown');
                }
            }
        };
    }

    if (componentDialog && componentDialog.rendered) {
        await componentDialog.close();
    }
    // Create dialog
    componentDialog = new Dialog(
        {
            title: 'Edit component',
            content: mainDiv[0].outerHTML,
            buttons: {
                validate: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Save',
                    callback: (html) => {
                        // Remove all editors to save rich text into the original textareas
                        tinymce.remove('.custom-system-component-editor-dialog textarea');

                        let newCompType = html.find('#compType').val();
                        let componentClass = componentFactory.getComponentClass(newCompType);
                        let fieldData = componentClass.extractConfig(html);

                        if (isDynamicTable && fieldData.key === '') {
                            throw new Error('Component key is mandatory for all fields in this container');
                        }

                        callback('edit', fieldData);
                    }
                },
                ...editButtons,
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            render: (html) => {
                const typeSelect = html.find('.custom-system-component-editor-dialog #compType');

                html.find(
                    '.custom-system-component-editor-dialog .custom-system-' + typeSelect.val() + '-editor'
                ).slideDown(200);

                // Change displayed fields based on previous and new types
                function changeDisplayedControls(ev) {
                    const target = $(ev.currentTarget);
                    const newType = target.val();
                    typeSelect.parents('.dialog').css('height', 'auto');

                    // Hide previous type's fields
                    html.find('.custom-system-component-editor-dialog .custom-system-component-editor').slideUp(200);

                    // Show new type's fields
                    html.find('.custom-system-component-editor-dialog .custom-system-' + newType + '-editor').slideDown(
                        200
                    );
                }

                // Each time the type Select is clicked, we save its current type
                // Each time it changed, we change the type display
                html.find('.custom-system-component-editor-dialog #compType').on('change', changeDisplayedControls);

                function checkComponentKey() {
                    const target = html.find('.custom-system-component-editor-dialog #compKey');
                    let val = target.val();

                    if (val && val.match(/^[a-zA-Z0-9_]+$/)) {
                        try {
                            math.parse(val);
                            math.evaluate(val);
                            html.find('.custom-system-key-warning').show();
                        } catch (err) {
                            html.find('.custom-system-key-warning').hide();
                        }
                    }
                }

                html.find('.custom-system-component-editor-dialog #compKey').on('change', checkComponentKey);
                checkComponentKey();
            }
        },
        {
            height: 'auto'
        }
    );
    componentDialog.render(true);
};

/**
 * Dialog for hidden attributes creation / edition
 * @param callback The callback to call on button click
 * @param attr The existing hidden attributes
 * @returns {Promise<void>}
 * @ignore
 */
const attributes = async (callback, attr) => {
    // Render the dialog's contents
    let content = await renderTemplate(`systems/custom-system-builder/templates/_template/dialogs/attributes.html`, {
        attribute: attr
    });

    if (attributesDialog && attributesDialog.rendered) {
        await attributesDialog.close();
    }

    // Create dialog
    attributesDialog = new Dialog(
        {
            title: 'Edit attributes',
            content: content,
            buttons: {
                validate: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Save',
                    callback: (html) => {
                        // Fetch all attribute rows
                        let attrEltList = html.find('tr.custom-system-hidden-attribute');
                        let attrList = [];

                        // For each of them, recover key and formula, and ensure none is empty
                        for (let attrElt of attrEltList) {
                            let attrName = $(attrElt).find('.custom-system-attribute-name').val();
                            let attrFormula = $(attrElt).find('.custom-system-attribute-formula').val();

                            if (attrName === '' || attrFormula === '') {
                                throw new Error('Name and Formula must be entered for each attribute');
                            }

                            attrList.push({ name: attrName, value: attrFormula });
                        }

                        callback(attrList);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            render: (html) => {
                let dialogElt = html.find('.custom-system-attributes').parents('.dialog');

                dialogElt.css({ 'max-height': '75%' });

                // Add attributes button
                html.find('.custom-system-attributes #addAttribute').on('click', (ev) => {
                    const target = $(ev.currentTarget);

                    // Last row contains only the add button
                    const lastRow = target.parents('tr');

                    // Create new row
                    const newRow = $(`<tr class="custom-system-hidden-attribute">
        <td><input type="text" class="custom-system-attribute-name"/></td>
        <td><textarea class="custom-system-attribute-formula"></textarea></td>
        <td class="custom-system-attribute-controls"><a class="custom-system-delete-hidden-attribute"><i class="fas fa-trash"></i></a></td>
    </tr>`);

                    // Insert new row before control row
                    lastRow.before(newRow);
                });

                // Delete attribute button
                html.on('click', '.custom-system-attributes .custom-system-delete-hidden-attribute', (ev) => {
                    // Get attributes row
                    const target = $(ev.currentTarget);
                    let row = target.parents('tr');

                    // Remove it from the DOM
                    $(row).remove();
                });
            }
        },
        {
            height: 'auto'
        }
    );
    attributesDialog.render(true);
};

/**
 * Dialog for attribute bars creation / edition
 * @param callback The callback to call on button click
 * @param attr The existing attribute bars
 * @returns {Promise<void>}
 * @ignore
 */
const attributeBars = async (callback, attr) => {
    for (let attrName in attr) {
        if (attr[attrName]) {
            attr[attrName].name = attrName;
        }
    }

    // Render the dialog's contents
    let content = await renderTemplate(`systems/custom-system-builder/templates/_template/dialogs/attributeBars.html`, {
        attribute: attr
    });

    if (attributeBarsDialog && attributeBarsDialog.rendered) {
        await attributeBarsDialog.close();
    }

    // Create dialog
    attributeBarsDialog = new Dialog(
        {
            title: 'Edit attribute bars',
            content: content,
            buttons: {
                validate: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Save',
                    callback: (html) => {
                        // Fetch all attribute rows
                        let attrBarEltList = html.find('tr.custom-system-attribute-bar');
                        let attrBarList = {};

                        // For each of them, recover key and formula, and ensure none is empty
                        for (let attrBarElt of attrBarEltList) {
                            let attrBarName = $(attrBarElt).find('.custom-system-attribute-name').val();
                            let attrBarValue = $(attrBarElt).find('.custom-system-attribute-value').val();
                            let attrBarMax = $(attrBarElt).find('.custom-system-attribute-max').val();

                            if (attrBarName === '' || attrBarValue === '' || attrBarMax === '') {
                                throw new Error('Name, Value and Maximum must be entered for each attribute bar');
                            }

                            attrBarList[attrBarName] = { value: attrBarValue, max: attrBarMax };
                        }

                        callback(attrBarList);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            render: (html) => {
                let dialogElt = html.find('.custom-system-attribute-bars').parents('.dialog');

                dialogElt.css({ 'max-height': '75%' });
                dialogElt.css({ 'min-width': '550px' });

                // Add attributes button
                html.find('.custom-system-attribute-bars #addAttributeBar').on('click', (ev) => {
                    const target = $(ev.currentTarget);

                    // Last row contains only the add button
                    const lastRow = target.parents('tr');

                    // Create new row
                    const newRow = $(`<tr class="custom-system-attribute-bar">
        <td><input type="text" class="custom-system-attribute-name"/></td>
        <td><input type="text" class="custom-system-attribute-value" /></td><td><input type="text" class="custom-system-attribute-max" /></td>
        <td class="custom-system-attribute-controls"><a class="custom-system-delete-attribute-bar"><i class="fas fa-trash"></i></a></td>
    </tr>`);

                    // Insert new row before control row
                    lastRow.before(newRow);
                });

                // Delete attribute button
                html.on('click', '.custom-system-attribute-bars .custom-system-delete-attribute-bar', (ev) => {
                    // Get attributes row
                    const target = $(ev.currentTarget);
                    let row = target.parents('tr');

                    // Remove it from the DOM
                    $(row).remove();
                });
            }
        },
        {
            height: 'auto',
            width: 'auto'
        }
    );
    attributeBarsDialog.render(true);
};

/**
 * Dialog for display settings edition
 * @param callback The callback to call on button click
 * @param attr The existing display settings
 * @returns {Promise<void>}
 * @ignore
 */
const displaySettings = async (callback, attr) => {
    // Render the dialog's contents
    let content = await renderTemplate(`systems/custom-system-builder/templates/_template/dialogs/display.html`, attr);

    if (displaySettingsDialog && displaySettingsDialog.rendered) {
        await displaySettingsDialog.close();
    }

    // Create dialog
    displaySettingsDialog = new Dialog({
        title: 'Edit display settings',
        content: content,
        buttons: {
            validate: {
                icon: '<i class="fas fa-check"></i>',
                label: 'Save',
                callback: (html) => {
                    let width = $(html).find('#custom-system-display-width').val();
                    let height = $(html).find('#custom-system-display-height').val();
                    let fix_size = $(html).find('#custom-system-display-fix-size').is(':checked');
                    let pp_width = $(html).find('#custom-system-display-pp-width').val();
                    let pp_height = $(html).find('#custom-system-display-pp-height').val();

                    callback({ width, height, fix_size, pp_width, pp_height });
                }
            },
            default: {
                icon: '<i class="fas fa-check"></i>',
                label: 'Default values',
                callback: () => {
                    let width = '600';
                    let height = '600';
                    let pp_width = '64';
                    let pp_height = '64';

                    callback({ width, height, pp_width, pp_height });
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel'
            }
        }
    });
    displaySettingsDialog.render(true);
};

const modifiers = async (callback, blocks) => {
    // Render the dialog's contents
    let content = await renderTemplate(`systems/custom-system-builder/templates/_template/dialogs/modifiers.html`, {
        blocks
    });

    if (modifiersDialog && modifiersDialog.rendered) {
        await modifiersDialog.close();
    }

    // Create the dialog
    modifiersDialog = new Dialog(
        {
            title: 'Configure modifiers',
            content: content,
            buttons: {
                validate: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Save modifiers',
                    callback: (html) => {
                        let newModifiers = {};
                        let modifierBlocks = html.find('.custom-system-modifiers');

                        for (let block of modifierBlocks) {
                            let blockId = $(block).data('block-id');

                            // Fetch all attribute rows
                            let modifierEltList = $(block).find('tr.custom-system-modifier');
                            let modifierList = [];

                            // For each of them, recover key and formula, and ensure none is empty
                            for (let modifierElt of modifierEltList) {
                                let modifierPriority = $(modifierElt).find('.custom-system-modifier-priority').val();
                                let modifierKey = $(modifierElt).find('.custom-system-modifier-key').val();
                                let modifierOperator = $(modifierElt).find('.custom-system-modifier-operator').val();
                                let modifierFormula = $(modifierElt).find('.custom-system-modifier-formula').val();

                                if (modifierKey === '' || modifierFormula === '') {
                                    throw new Error('Name and Formula must be entered for each attribute');
                                }

                                modifierList.push({
                                    priority: Number.isNaN(Number(modifierPriority)) ? 0 : Number(modifierPriority),
                                    key: modifierKey,
                                    operator: modifierOperator,
                                    formula: modifierFormula
                                });
                            }

                            newModifiers[blockId] = modifierList;
                        }

                        callback(newModifiers);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            default: 'cancel',
            render: (html) => {
                let dialogElt = html.find('.custom-system-modifiers').parents('.dialog');

                dialogElt.css({ 'max-height': '75%' });

                html.find('.custom-system-block-title').on('click', (ev) => {
                    let target = $(ev.currentTarget);
                    let blockId = target.data('block-id');

                    let modifiersDiv = html.find('#modifiers_' + blockId);
                    if (modifiersDiv.is(':visible')) {
                        modifiersDiv.slideUp(500);
                        target.find('.fa-caret-down').addClass('fa-caret-right').removeClass('fa-caret-down');
                    } else {
                        modifiersDiv.slideDown(500);
                        target.find('.fa-caret-right').addClass('fa-caret-down').removeClass('fa-caret-right');
                    }
                });

                // Add attributes button
                html.find('.custom-system-modifiers #addModifier').on('click', (ev) => {
                    const target = $(ev.currentTarget);

                    // Last row contains only the add button
                    const lastRow = target.parents('tr');

                    // Create new row
                    const newRow = $(
                        `<tr class="custom-system-modifier"><td>
<input type="number" class="custom-system-modifier-priority" value="0" /></td><td>
<input type="text" class="custom-system-modifier-key" /></td><td><select class="custom-system-modifier-operator">
<option value="add">+</option><option value="multiply">x</option><option value="subtract">-</option>
<option value="divide">/</option><option value="set">=</option></select></td><td><textarea class="custom-system-modifier-formula"></textarea></td>
<td class="custom-system-modifier-controls"><a class="custom-system-delete-modifier"><i class="fas fa-trash"></i></a>
</td></tr>`
                    );

                    // Insert new row before control row
                    lastRow.before(newRow);
                });

                // Delete attribute button
                html.on('click', '.custom-system-modifiers .custom-system-delete-modifier', (ev) => {
                    // Get attributes row
                    const target = $(ev.currentTarget);
                    let row = target.parents('tr');

                    // Remove it from the DOM
                    $(row).remove();
                });
            }
        },
        { height: 'auto' }
    );
    modifiersDialog.render(true);
};

export default {
    editTab,
    component,
    attributes,
    attributeBars,
    displaySettings,
    modifiers
};
