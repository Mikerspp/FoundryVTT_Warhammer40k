import Panel from './components/Panel.js';

/**
 * Extend the basic ActorSheet
 * @abstract
 * @extends {ActorSheet}
 * @ignore
 */
export class CustomActorSheet extends ActorSheet {
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

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['custom-system', 'sheet', 'actor'],
            template: 'systems/custom-system-builder/templates/actor/actor-sheet.html',
            width: 600,
            height: 600,
            tabs: [
                {
                    navSelector: '.sheet-tabs',
                    contentSelector: '.sheet-body'
                }
            ],
            scrollY: ['.custom-system-actor']
        });
    }

    /**
     * @override
     * @ignore
     */
    get template() {
        return `systems/custom-system-builder/templates/actor/actor-${this.actor.data.type}-sheet.html`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        // Retrieve the data structure from the base sheet. You can inspect or log
        // the context variable to see the structure, but some key properties for
        // sheets are the actor object, the data object, whether or not it's
        // editable, the items array, and the effects array.
        const context = super.getData();

        // Use a safe clone of the actor data for further operations.
        const actorData = context.actor.data;

        // Add the actor's data to context.data for easier access, as well as flags.
        context.data = actorData.data;
        context.flags = actorData.flags;

        // Add roll data for TinyMCE editors.
        context.rollData = context.actor.getRollData();

        this._customHeader = Panel.fromJSON(context.data.header, 'header');
        this._customBody = Panel.fromJSON(context.data.body, 'body');

        return context;
    }

    /**
     * Pre-renders sheet contents
     * @param context
     * @protected
     * @ignore
     */
    async _prepareSheetData(context) {
        // Render header like any tab
        let header = await this._customHeader.render(this.actor, this.isEditable);
        let body = await this._customBody.render(this.actor, this.isEditable);

        context.headerPanel = header;
        context.bodyPanel = body;

        context.isGM = game.user.isGM;
        context.display = context.data.display;
        context.template = context.data.template;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
    }
}

let focusedElt;

/* Insert tabs & header on sheet rendering */
Hooks.on('renderCustomActorSheet', function (app, html, data) {
    // Append built sheet to html
    html.find('.custom-system-customHeader').append(data.headerPanel);
    html.find('.custom-system-customBody').append(data.bodyPanel);

    // Register in-sheet rich text editors
    html.find('.editor-content[data-edit]').each((i, div) => app._activateEditor(div));

    html.find('input').on('focus', (ev) => {
        focusedElt = ev.currentTarget.id;
    });

    // Scroll back to previous position
    html.scrollTop(app?._scrollPositions?.['.custom-system-actor']?.[0] ?? 0);

    if (focusedElt) {
        html.find('#' + focusedElt).trigger('focus');
    }
});
