import Panel from '../components/Panel.js';
import templateFunctions from '../template-functions.js';

/**
 * Extend the basic ActorSheet
 * @abstract
 * @extends {ActorSheet}
 * @ignore
 */
export class EquippableItemSheet extends ItemSheet {
    /**
     * Header part
     * @type {Panel}
     * @private
     */
    _customHeader;

    /**
     * Body part
     * @type {Panel}
     * @private
     */
    _customBody;

    constructor(item, options) {
        options.resizable = !item.data.data.display.fix_size;

        super(item, options);
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['custom-system', 'sheet', 'item'],
            template: 'systems/custom-system-builder/templates/item/item-sheet.html',
            width: 600,
            height: 600,
            tabs: [
                {
                    navSelector: '.sheet-tabs',
                    contentSelector: '.sheet-body'
                }
            ],
            scrollY: ['.custom-system-item']
        });
    }

    /**
     * @override
     * @ignore
     */
    get template() {
        return `systems/custom-system-builder/templates/item/${this.item.data.type}-sheet.html`;
    }

    /* -------------------------------------------- */

    /** @override */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData();

        // Use a safe clone of the actor data for further operations.
        const itemData = context.item.data;

        // Add the actor's data to context.data for easier access, as well as flags.
        context.data = itemData.data;
        context.flags = itemData.flags;

        this._customHeader = Panel.fromJSON(context.data.header, 'header');
        this._customBody = Panel.fromJSON(context.data.body, 'body');

        await this._prepareSheetData(context);

        context.isEmbedded = context.item.isEmbedded;
        context.isEditable = this.isEditable;

        return context;
    }

    _hasBeenRenderedOnce = false;

    /**
     * @override
     * @param force
     * @param options
     * @return {DocumentSheet|*}
     * @ignore
     */
    render(force, options = {}) {
        if (!this._hasBeenRenderedOnce) {
            this.position.width = this.item.data.data.display.width;
            this.position.height = this.item.data.data.display.height;

            this._hasBeenRenderedOnce = true;
        }

        this.options.resizable = !this.item.data.data.display.fix_size;

        let data = super.render(force, options);

        return data;
    }

    /**
     * Pre-renders sheet contents
     * @param context
     * @protected
     * @ignore
     */
    async _prepareSheetData(context) {
        context.availableTemplates = game.items.filter((item) => item.data.type === '_equippableItemTemplate');

        // Render header like any tab
        let header = await this._customHeader.render(this.item, this.isEditable);
        let body = await this._customBody.render(this.item, this.isEditable);

        context.headerPanel = header;
        context.bodyPanel = body;

        context.isGM = game.user.isGM;
        context.display = context.data.display;
        context.template = context.data?.template;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        // Template reload button
        html.find('.custom-system-template-select #custom-system-reload-template').click((ev) => {
            if (game.user.isGM) {
                const target = $(ev.currentTarget);
                const templateId = target.parents('.custom-system-template-select').find('#template').val();

                this.item.reloadTemplate(templateId);
            }
        });

        // Template reload button
        html.find('.custom-system-configure-modifiers').click(async (ev) => {
            if (this.isEditable) {
                let modifierBlock = {
                    modifiers: this.item.data.data.modifiers,
                    id: 'item_mod',
                    label: 'Item modifiers',
                    visible: true
                };

                templateFunctions.modifiers(
                    (newModifiers) => {
                        // Update the actor with new hidden attributes
                        this.item
                            .update({
                                data: {
                                    modifiers: newModifiers.item_mod
                                }
                            })
                            .then(() => {
                                this.render(false);
                            });
                    },
                    [modifierBlock]
                );
            }
        });
    }
}

let focusedElt;

/* Insert tabs & header on sheet rendering */
Hooks.on('renderEquippableItemSheet', function (app, html, data) {
    // Append built sheet to html
    html.find('.custom-system-customHeader').append(data.headerPanel);
    html.find('.custom-system-customBody').append(data.bodyPanel);

    // Register in-sheet rich text editors
    html.find('.editor-content[data-edit]').each((i, div) => app._activateEditor(div));

    html.find('input').on('focus', (ev) => {
        focusedElt = ev.currentTarget.id;
    });

    // Scroll back to previous position
    html.scrollTop(app?._scrollPositions?.['.custom-system-item']?.[0] ?? 0);

    if (focusedElt) {
        html.find('#' + focusedElt).trigger('focus');
    }
});
