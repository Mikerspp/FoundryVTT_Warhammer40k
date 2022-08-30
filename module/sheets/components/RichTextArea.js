import InputComponent from './InputComponent.js';

/**
 * Rich text area component
 * @ignore
 */
class RichTextArea extends InputComponent {
    /**
     * Rich text area style
     * @type {string}
     * @private
     */
    _style;

    /**
     * Rich text area constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from actor.data.data object
     * @param {string|null} [data.label=null] Field label
     * @param {string|null} [data.defaultValue=null] Field default value
     * @param {string} [data.style=sheet] Text Area style. Can be sheet, dialog or icon.
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        label = null,
        defaultValue = null,
        style = 'sheet',
        size = null,
        cssClass = null,
        role = 0,
        permission = 0
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            label: label,
            defaultValue: defaultValue,
            size: size,
            cssClass: cssClass,
            role: role,
            permission: permission
        });
        this._style = style;
    }

    /**
     * Renders component
     * @override
     * @param {CustomActor} actor
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(actor, isEditable = true, options = {}) {
        let jQElement = await super._getElement(actor, isEditable, options);
        jQElement.addClass('custom-system-text-area');
        jQElement.addClass('custom-system-rich-editor' + (this._style !== 'sheet' ? '-dialog' : ''));

        if (!actor.isTemplate) {
            let contents = (foundry.utils.getProperty(actor.data.data.props, this.key) || this.defaultValue) ?? '';
            let enrichedContents = TextEditor.enrichHTML(contents, {
                secrets: isEditable,
                rollData: actor.getRollData()
            });

            let editButton = $('<a></a>');
            editButton.addClass('custom-system-rich-editor-button');
            editButton.html('<i class="fas fa-edit"></i>');

            editButton.on('click', () => {
                let content = `<textarea id='custom-system-rich-text-editor-${this.key}' class='custom-system-rich-text-editor'>${contents}</textarea>`;

                // Dialog creation
                let d = new Dialog(
                    {
                        title: 'Text editor',
                        content: content,
                        buttons: {
                            validate: {
                                icon: '<i class="fas fa-check"></i>',
                                label: 'Save',
                                callback: () => {
                                    // Recover rich text editor content and save it to the right prop
                                    foundry.utils.setProperty(
                                        actor.data.data.props,
                                        this.key,
                                        tinymce.get(`custom-system-rich-text-editor-${this.key}`).getContent()
                                    );

                                    actor.update({
                                        data: {
                                            props: actor.data.data.props
                                        }
                                    });
                                }
                            },
                            cancel: {
                                icon: '<i class="fas fa-times"></i>',
                                label: 'Cancel'
                            }
                        },
                        render: () => {
                            //Pre-emptively remove editors to guarantee init
                            tinymce.remove('textarea.custom-system-rich-text-editor');
                            tinymce.init({
                                ...CONFIG.TinyMCE,
                                selector: 'textarea.custom-system-rich-text-editor',
                                save_onsavecallback: (mce) => {
                                    $(`#custom-system-rich-text-editor-${this.key}`)
                                        .parents('.dialog')
                                        .find('.dialog-button.validate')
                                        .trigger('click');
                                },
                                init_instance_callback: function (editor) {
                                    editor.on('drop', async function (e) {
                                        e.preventDefault();
                                        editor.execCommand(
                                            'InsertText',
                                            false,
                                            await TextEditor.getContentLink(TextEditor.getDragEventData(e))
                                        );
                                    });
                                }
                            });
                        }
                    },
                    {
                        width: 500,
                        height: 280,
                        resizable: true
                    }
                );
                d.render(true);
            });

            let editor = null;
            switch (this._style) {
                case 'sheet':
                    if (isEditable) {
                        editor = $(
                            HandlebarsHelpers.editor({
                                hash: {
                                    target: 'data.props.' + this.key,
                                    content: contents,
                                    button: true,
                                    editable: isEditable
                                }
                            }).toHTML()
                        );
                    } else {
                        editor = $('<div></div>');
                        editor.addClass('custom-system-rich-content');
                        editor.html(enrichedContents);
                    }

                    editButton = null;
                    break;
                case 'dialog':
                    editor = $('<div></div>');
                    editor.addClass('custom-system-rich-content');
                    editor.html(enrichedContents);

                    if (contents !== '') {
                        editButton.addClass('custom-system-rich-editor-button-float');
                    }
                    jQElement
                        .on('mouseover', () => {
                            editButton.show();
                        })
                        .on('mouseleave', () => {
                            if (contents !== '') {
                                editButton.hide();
                            }
                        });
                    break;
                case 'icon':
                default:
                    break;
            }

            jQElement.append(editor);
            if (isEditable) {
                jQElement.append(editButton);
            }
        } else {
            jQElement.addClass('custom-system-editable-component');
            jQElement.append(this.defaultValue === '' ? '&#9744;' : this.defaultValue);
            jQElement.append($('<i class="fas fa-paragraph"></i>'));

            jQElement.on('click', () => {
                this.editComponent(actor);
            });
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
            style: this._style,
            type: 'textArea'
        };
    }

    /**
     * Creates RichTextArea from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @return {RichTextArea}
     */
    static fromJSON(json, templateAddress) {
        return new RichTextArea({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            label: json.label,
            defaultValue: json.defaultValue,
            style: json.style,
            size: json.size,
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
        return 'Rich Text Area';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                'systems/custom-system-builder/templates/_template/components/textArea.html',
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

        if (!fieldData.key) {
            throw new Error('Component key is mandatory for rich text areas');
        }

        fieldData.label = html.find('#textAreaLabel').val();
        fieldData.defaultValue = html.find('#textAreaValue').val();
        fieldData.style = html.find('#textAreaStyle').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default RichTextArea;
