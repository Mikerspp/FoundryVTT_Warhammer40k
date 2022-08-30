import templateFunctions from '../template-functions.js';
import Panel from '../components/Panel.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {CustomActorSheet}
 * @ignore
 */
export class SubTemplateItemSheet extends ItemSheet {
    /**
     * SubTemplate Contents
     * @type {Panel}
     * @private
     */
    _contents;

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['custom-system', 'sheet', 'item', 'subtemplate'],
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

    /** @override */
    async getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = await super.getData();

        // Use a safe clone of the actor data for further operations.
        const itemData = context.item.data;

        // Add the actor's data to context.data for easier access, as well as flags.
        context.data = itemData.data;
        context.flags = itemData.flags;

        this._contents = Panel.fromJSON(context.data.body, 'body');

        await this._prepareSheetData(context);

        return context;
    }

    /**
     * Pre-renders sheet contents
     * @param context
     * @protected
     * @ignore
     */
    async _prepareSheetData(context) {
        context.bodyPanel = await this._contents.render(this.item, this.isEditable);

        context.isGM = game.user.isGM;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // -------------------------------------------------------------
        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) return;

        html.on('dragenter', (event) => {
            html.find('.custom-system-droppable-container').addClass('custom-system-template-dragged-eligible');
        });

        $(document).on('dragend', () => {
            $('.custom-system-template-dragged-eligible').removeClass(
                'custom-system-template-dragged-eligible custom-system-template-dragged-over'
            );
        });
    }
}

/* Insert tabs & header on sheet rendering */
Hooks.on('renderSubTemplateItemSheet', function (app, html, data) {
    // Append built sheet to html
    html.find('.custom-system-customBody').append(data.bodyPanel);

    // Scroll back to previous position
    html.scrollTop(app?._scrollPositions?.['.custom-system-item']?.[0] ?? 0);
});
