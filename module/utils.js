/**
 * Encodes string to HTML entities
 * @param text
 * @returns {*|string}
 * @ignore
 */
export const encodeHTMLEntities = (text) => {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

/**
 * @ignore
 */
export const postCustomSheetRoll = async (messageText, alternative = false) => {
    let actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;

    if (actor && actor.testUserPermission(game.user, CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER)) {
        try {
            actor.roll(messageText, { alternative });
        } catch (err) {
            ui.notifications.error(err.message);
        }
    } else {
        ui.notifications.error('No suitable selected actor to roll for');
    }
};

/**
 * Posts a chat message with a computed phrase data
 * @param {{buildPhrase: string, values: {}}} textContent
 * @param msgOptions
 * @param rollMode
 * @param create
 * @returns {Promise<void>}
 * @ignore
 */
export const postAugmentedChatMessage = async (textContent, msgOptions = {}, { rollMode, create = true } = {}) => {
    rollMode = rollMode || game.settings.get('core', 'rollMode');

    // chat-roll is just the html template for computed formulas
    const template_file = `systems/custom-system-builder/templates/chat/chat-roll.html`;

    let phrase = textContent.buildPhrase;
    let values = textContent.values;

    let rolls = [];

    // Render all formulas HTMLs
    for (let key in values) {
        let formattedValue = String(values[key].result);
        if (values[key].explanation) {
            formattedValue = await renderTemplate(template_file, {
                rollData: values[key],
                jsonRollData: JSON.stringify(values[key]),
                rollMode: rollMode
            });
        }

        if (phrase.startsWith('/')) {
            formattedValue = formattedValue.replaceAll(/"/g, '\\"');
        }

        phrase = phrase.replace(key, formattedValue);

        for (let roll of values[key].rolls) {
            rolls.push(Roll.fromData(roll.roll));
        }
    }

    phrase = phrase.replaceAll(/\n/g, '').trim();

    let msgRoll = null;
    let chatRollData = {};
    if (rolls.length > 0) {
        const pool = PoolTerm.fromRolls(rolls);
        msgRoll = Roll.fromTerms([pool]);

        chatRollData = {
            roll: msgRoll,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rollMode
        };
    }

    let whisper = null;

    // If setting expandRollVisibility is checked, we apply the appropriate whispers to the message
    if (game.settings.get('custom-system-builder', 'expandRollVisibility')) {
        let gmList = game.users.filter((user) => user.isGM).map((user) => user.id);

        switch (rollMode) {
            case CONST.DICE_ROLL_MODES.PRIVATE:
                whisper = gmList;
                break;
            case CONST.DICE_ROLL_MODES.BLIND:
                whisper = gmList;
                break;
            case CONST.DICE_ROLL_MODES.SELF:
                whisper = [game.userId];
                break;
            default:
                break;
        }
    }

    let msg = new ChatMessage(
        foundry.utils.mergeObject(
            msgOptions,
            foundry.utils.mergeObject(
                {
                    content: phrase,
                    whisper,
                    sound: CONFIG.sounds.dice
                },
                chatRollData
            )
        )
    );

    if (create) {
        // Final chat message creation
        return ChatMessage.create(
            foundry.utils.mergeObject(
                msgOptions,
                foundry.utils.mergeObject(
                    {
                        content: phrase,
                        whisper,
                        sound: CONFIG.sounds.dice
                    },
                    chatRollData
                )
            )
        );
    } else {
        if (rollMode) {
            msg.applyRollMode(rollMode);
        }
        return msg.data.toObject();
    }
};

/**
 * Compares two software version numbers (e.g. "1.7.1" or "1.2b").
 *
 * This function was born in http://stackoverflow.com/a/6832721.
 *
 * @param {string} v1 The first version to be compared.
 * @param {string} v2 The second version to be compared.
 * @param {object} [options] Optional flags that affect comparison behavior:
 * <ul>
 *     <li>
 *         <tt>lexicographical: true</tt> compares each part of the version strings lexicographically instead of
 *         naturally; this allows suffixes such as "b" or "dev" but will cause "1.10" to be considered smaller than
 *         "1.2".
 *     </li>
 *     <li>
 *         <tt>zeroExtend: true</tt> changes the result if one version string has less parts than the other. In
 *         this case the shorter string will be padded with "zero" parts instead of being considered smaller.
 *     </li>
 * </ul>
 * @returns {number|NaN}
 * <ul>
 *    <li>0 if the versions are equal</li>
 *    <li>a negative integer iff v1 < v2</li>
 *    <li>a positive integer iff v1 > v2</li>
 *    <li>NaN if either version string is in the wrong format</li>
 * </ul>
 *
 * @copyright by Jon Papaioannou (["john", "papaioannou"].join(".") + "@gmail.com")
 * @license This function is in the public domain. Do what you want with it, no strings attached.
 * @ignore
 */
export const versionCompare = (v1, v2, options) => {
    var lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push('0');
        while (v2parts.length < v1parts.length) v2parts.push('0');
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (var i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        } else if (v1parts[i] > v2parts[i]) {
            return 1;
        } else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
};

/**
 * @ignore
 */
export const applyModifiers = (value, modifiers = []) => {
    modifiers = modifiers.sort((mod1, mod2) => {
        const operatorOrder = ['set', 'multiply', 'divide', 'add', 'subtract'];

        let sortIndex = mod1.priority - mod2.priority;

        if (sortIndex === 0) {
            sortIndex = operatorOrder.indexOf(mod1.operator) - operatorOrder.indexOf(mod2.operator);
        }

        return sortIndex;
    });

    for (let modifier of modifiers) {
        switch (modifier.operator) {
            case 'set':
                value = Number(modifier.value);
                break;
            case 'multiply':
                value = Number(value) * Number(modifier.value);
                break;
            case 'divide':
                value = Number(value) / Number(modifier.value);
                break;
            case 'subtract':
                value = Number(value) - Number(modifier.value);
                break;
            case 'add':
            default:
                value = Number(value) + Number(modifier.value);
                break;
        }
    }

    return value;
};
