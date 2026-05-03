// #region CONSTANTS AND VARIABLES

//Making a script namespace for storing in state object
state.BuffHelper = state.BuffHelper || {};

// Custom status marker constants for Roll20 buffs
const LONGSTRIDER_STATUS = 'LongstriderCF::6728234';
const BLADESONG_STATUS = 'BladesongCF::6552889';
const BLUR_STATUS = 'BlurCF::6552890';
const RAGE_STATUS = 'RageCF::6554571';
const BOOTS_OF_SPEED_STATUS = 'BootsOfSpeedCF::6552891';
const NUMBER_1_STATUS = 'Number1CF::6947808';
const NUMBER_2_STATUS = 'Number2CF::6947809';
const NUMBER_3_STATUS = 'Number3CF::6947810';

// Mapping buffs to their corresponding status markers for easy reference
const BUFF_STATUS_MARKER_MAP = {
    'Bladesong': BLADESONG_STATUS,
    'Blur': BLUR_STATUS,
    'Longstrider': LONGSTRIDER_STATUS,
    'Rage': RAGE_STATUS,
    'Boots of Speed': BOOTS_OF_SPEED_STATUS,
    'Mirror Image': [NUMBER_3_STATUS, NUMBER_2_STATUS, NUMBER_1_STATUS],
};

// Function maps for activating and deactivating buffs
const activateBuffFunctionMap = {
    'Bladesong': activateBladesong,
    'Blur': activateBlur,
    'Rage': activateRage,
    'Boots of Speed': activateBootsOfSpeed,
    'Mirror Image': activateMirrorImage,
};

const deactivateBuffFunctionMap = {
    'Bladesong': deactivateBladesong,
    'Blur': deactivateBlur,
    'Rage': deactivateRage,
    'Boots of Speed': deactivateBootsOfSpeed,
    'Mirror Image': deactivateMirrorImage,
};


// Stores active buffs with their start round and duration for tracking
state.BuffHelper.activeBuffs = state.BuffHelper.activeBuffs || {};
state.BuffHelper.buffsWithoutDuration = state.BuffHelper.buffsWithoutDuration || {};

// Stores buff in chronical order of their application
state.BuffHelper.buffOrder = state.BuffHelper.buffOrder || {};

// Used to store the speed value which were doubled
state.BuffHelper.bootsOfSpeedData = state.BuffHelper.bootsOfSpeedData || {};

// #endregion


// #region EVENT HANDLERS

// Event handler for processing API chat messages
on('chat:message', function(message) {
    // Filter out non-API and system-generated messages
    if(message.type === "api" && !message.content.startsWith('Buff Helper')) {
        let selected = message.selected;
        if(selected && selected.length > 0){
            // Process each selected token
            _.each(selected, function(obj){
                let token = getObj("graphic", obj._id);
                if(token){
                    let characterId = token.get("represents");
                    let character = getObj("character", characterId);

                    // Execute corresponding buff toggle functions based on chat command
                    if(message.content.indexOf("!toggleLongstrider") !== -1) {
                        toggleBuff(token, character, LONGSTRIDER_STATUS, 'speed', 10, 'Longstrider');
                    }
                    else if(message.content.indexOf("!toggleBladesong") !== -1) {
                        toggleBuffWithDuration(token, character, 'Bladesong', BLADESONG_STATUS, 10, activateBladesong, deactivateBladesong);
                    }
                    else if(message.content.indexOf("!toggleBlur") !== -1) {
                        toggleBuffWithDuration(token, character, 'Blur', BLUR_STATUS, 10, activateBlur, deactivateBlur);
                    }
                    else if(message.content.indexOf("!toggleRage") !== -1) {
                        toggleBuffWithDuration(token, character, 'Rage', RAGE_STATUS, 10, activateRage, deactivateRage);
                    }
                    else if(message.content.indexOf("!toggleBootsOfSpeed") !== -1) {
                        toggleBuffWithDuration(token, character, 'Boots of Speed', BOOTS_OF_SPEED_STATUS, 60, activateBootsOfSpeed, deactivateBootsOfSpeed);
                    }
                    else if(message.content.indexOf("!toggleMirrorImage") !== -1) {
                        toggleBuffWithDuration(token, character, 'Mirror Image', BUFF_STATUS_MARKER_MAP['Mirror Image'], 10, activateMirrorImage, deactivateMirrorImage);
                    }

                    // Used to track when hit for Mirror Image
                    else if(message.content.indexOf("!hit") !== -1) {
                        if(character){
                            processMirrorImageHit(token, character);
                        }
                    }
                }
            });
        }
    }
});

// Event handler for monitoring changes in the turn order
on("change:campaign:turnorder", function() {
    let turnOrder = JSON.parse(Campaign().get("turnorder") || "[]");
    let currentRound = getRoundNumber();

    // Check for buffs that need to be deactivated based on their duration
    if (turnOrder.length > 0) {
        let currentTokenId = turnOrder[0].id; // Assuming the first token is the active one

        // Loop through each active buff to check for expiration
        _.each(state.BuffHelper.activeBuffs, function(buffDetails, characterId) {
            _.each(buffDetails, function(details, buffName) {
                if (currentRound >= details.startRound + details.duration) {
                    let tokens = findObjs({ 
                        _type: "graphic", 
                        _pageid: Campaign().get("playerpageid"), 
                        represents: characterId 
                    });

                    let isActiveToken = tokens.some(token => token.id === currentTokenId);

                    if (isActiveToken) {
                        let character = getObj("character", characterId);
                        if (character) {
                            let token = tokens.find(token => token.id === currentTokenId);
                            if (token) {
                                // Deactivate the buff using mapped functions
                                toggleBuffWithDuration(token, character, buffName, BUFF_STATUS_MARKER_MAP[buffName], details.duration, activateBuffFunctionMap[buffName], deactivateBuffFunctionMap[buffName]);
                                sendChat('Buff Helper', `/w ${getFirstName(character)} ${details.duration} rounds have passed and it's ${getFirstName(character)}'s turn. Deactivating ${buffName}.`);
                            } else {
                                sendChat('Buff Helper', `/w ${getFirstName(character)} Error: Active Token not found for character ID ${characterId}.`);
                            }
                        } else {
                            sendChat('Buff Helper', `/w ${getFirstName(character)} Error: Character not found for character ID ${characterId}.`);
                        }

                        // Clean up the buff from state.BuffHelper.activeBuffs object
                        delete state.BuffHelper.activeBuffs[characterId][buffName];
                    }
                }
            });
        });
    }
});

// #endregion


// #region FUNCTIONS FOR SPECIFIC BUFF ACTIVATION AND DEACTIVATION

function activateBladesong(character) {
    // Increase AC and Speed
    modifyAttributeByAnother(character, 'AC', 'intelligence_mod', true);
    modifyAttribute(character, 'Bladesong', 'speed', 10, true);
}

function deactivateBladesong(character) {
    // Revert AC and Speed
    modifyAttributeByAnother(character, 'AC', 'intelligence_mod', false);
    modifyAttribute(character, 'Bladesong', 'speed', 10, false);
}

function activateBlur(character) {
    sendDelayedChat('Buff Helper', `/w ${getFirstName(character)} Enemies have disadvantage on Attack Rolls against you.`, 100);
}

function deactivateBlur(character) {
    sendDelayedChat('Buff Helper', `/w ${getFirstName(character)} Enemies no longer have disadvantage on Attack Rolls against you.`, 100);
}

function activateRage(character) {
    sendDelayedChat('Buff Helper', `/w ${getFirstName(character)} ARRRRRRRGGGGGG!`, 100);
}

function deactivateRage(character) {
    sendDelayedChat('Buff Helper', `/w ${getFirstName(character)} Chill my dude.`, 100);
}

function activateBootsOfSpeed(character) {
    let originalSpeed = getBaseSpeed(character);
    state.BuffHelper.bootsOfSpeedData[character.id] = { originalSpeed: originalSpeed};
    
    initializeBuffOrder(character.id);
    modifyAttribute(character, 'Boots of Speed', 'speed', originalSpeed, true);
}

function deactivateBootsOfSpeed(character) {
    let characterName = getFirstName(character);
    if (state.BuffHelper.bootsOfSpeedData[character.id]) {
        let originalSpeed = state.BuffHelper.bootsOfSpeedData[character.id].originalSpeed;
        let totalReduction = originalSpeed;
        let priorBuffs = state.BuffHelper.buffOrder[character.id].filter(buff => buff.name !== "Boots of Speed");

        // Ensure state.BuffHelper.buffOrder for the character is initialized and not empty
        if (state.BuffHelper.buffOrder[character.id] && state.BuffHelper.buffOrder[character.id].length > 0) {
            for (let buff of priorBuffs) {
                if (!buff.shouldGetBuffed) {
                    // TODO: Maybe not hardcode this to always be 10. If I ever get a speedbuff that doesn't boost with exactly 10, this is going to cause errors
                    totalReduction -= 10;
                }
            }
        }

        modifyAttribute(character, 'Boots of Speed', 'speed', totalReduction, false);

        // Clear data for the next activation
        delete state.BuffHelper.bootsOfSpeedData[character.id];
        delete state.BuffHelper.buffOrder[character.id]; // Reset the buff order
    } else {
        sendChat('Buff Helper', `/w ${characterName} Error: originalSpeed data not found for Boots of Speed.`);
    }
}

function activateMirrorImage(character) {
    let characterId = character.id;
    state.BuffHelper.activeBuffs[characterId]['Mirror Image']['imagesLeft'] = 3;
    sendDelayedChat('Buff Helper', `/w ${getFirstName(character)} Mirror Image activated. You have 3 images.`, 100);
}

function deactivateMirrorImage(character) {
    //sendDelayedChat('Buff Helper', `/w ${getFirstName(character)} Mirror Image has ended.`, 100);
}

// #endregion


// #region ATTRIBUTE ALTERING FUNCTIONS

function modifyAttribute(character, buffName, attributeName, valueChange, shouldAdd) {
    let attribute = findObjs({ type: 'attribute', characterid: character.id, name: attributeName })[0];
    if (attribute) {
        let characterName = getFirstName(character);
        let currentValue = parseInt(attribute.get('current')) || 0;

        // Checking for multiplication on speed here
        if (attributeName === 'speed' && getBuffByName(character.id, buffName) && !shouldAdd) {
            valueChange = bootsOfSpeedHelper(character.id, buffName, valueChange);
            setShouldGetBuffed(character.id, buffName, false);
        }

        let newValue = shouldAdd ? currentValue + valueChange : currentValue - valueChange;
        attribute.set('current', newValue);
        sendDelayedChat('Buff Helper', `/w ${characterName} ${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} is now: ` + newValue, 100);
    } else {
        sendChat('Buff Helper', `/w ${characterName} Attribute ` + attributeName + ' not found for character');
    }
}

function modifyAttributeByAnother(character, baseAttributeName, modifierAttributeName, shouldAdd) {
    let baseAttribute = findObjs({ type: 'attribute', characterid: character.id, name: baseAttributeName })[0];
    let modifierAttribute = findObjs({ type: 'attribute', characterid: character.id, name: modifierAttributeName })[0];
    let characterName = getFirstName(character);

    if (baseAttribute && modifierAttribute) {
        let baseValue = parseInt(baseAttribute.get('current')) || 0;
        let modifierValue = parseInt(modifierAttribute.get('current')) || 0;
        let newValue = shouldAdd ? baseValue + modifierValue : baseValue - modifierValue;
        baseAttribute.set('current', newValue);
        sendDelayedChat('Buff Helper', `/w ${characterName} ${baseAttributeName.charAt(0).toUpperCase() + baseAttributeName.slice(1)} is now: ` + newValue, 100);
    } else {
        sendChat('Buff Helper', `/w ${characterName} Attribute ` + baseAttributeName + ' or ' + modifierAttributeName + ' not found for character');
    }
}

// #endregion


// #region BUFF TOGGLE FUNCTIONS

function toggleBuff(token, character, statusMarker, attributeName, valueChange, buffName) {
    // Get current status markers of the token
    let currentStatusMarkers = token.get("statusmarkers");
    let characterName = getFirstName(character);

    state.BuffHelper.buffsWithoutDuration[character.id] = state.BuffHelper.buffsWithoutDuration[character.id] || [];
    
    // Check if the specific buff's status marker is currently active
    let isMarkerActive = currentStatusMarkers.includes(statusMarker);
    
    // Toggling the status marker
    let newStatusMarkers;
    if (isMarkerActive) {
        // If marker is active, remove it
        newStatusMarkers = currentStatusMarkers.replace(statusMarker, "").replace(/,{2,}/g, ',').replace(/^,|,$/g, '');
        state.BuffHelper.buffsWithoutDuration[character.id] = state.BuffHelper.buffsWithoutDuration[character.id].filter(buff => buff !== buffName);
        sendChat('Buff Helper', `/w ${characterName} Removing ${buffName} from ${characterName}.`);
    } else {
        // If marker is not active, add it
        newStatusMarkers = currentStatusMarkers ? currentStatusMarkers + "," + statusMarker : statusMarker;
        state.BuffHelper.buffsWithoutDuration[character.id].push(buffName);
        sendChat('Buff Helper', `/w ${characterName} Buffed ${characterName} with ${buffName}.`);
    }

    // Update the token's status markers
    token.set("statusmarkers", newStatusMarkers);

    // Proceed to update the character attribute
    if (character) {
        modifyAttribute(character, buffName, attributeName, valueChange, !isMarkerActive);
    } else {
        sendChat('Buff Helper', '/w Niic Character not found for token ' + token.get('name'));
    }
}

function toggleBuffWithDuration(token, character, buffName, statusMarker, duration, onActivate, onDeactivate) {
    let characterId = character.id;
    let characterName = getFirstName(character);
    let currentStatusMarkers = token.get("statusmarkers") || '';
    let isMarkerActive = false;

    if (Array.isArray(statusMarker)) {
        // Check if any of the status markers are active
        isMarkerActive = statusMarker.some(marker => currentStatusMarkers.includes(marker));
    } else {
        isMarkerActive = currentStatusMarkers.includes(statusMarker);
    }

    state.BuffHelper.activeBuffs[characterId] = state.BuffHelper.activeBuffs[characterId] || {};

    if (character) {
        if (isMarkerActive) {
            // Deactivate the buff
            delete state.BuffHelper.activeBuffs[characterId][buffName];
            if (Array.isArray(statusMarker)) {
                // Check if any of the status markers are active
                statusMarker.forEach(marker => {
                    currentStatusMarkers = currentStatusMarkers.replace(marker, "").replace(/,{2,}/g, ',').replace(/^,|,$/g, '');
                });
            } else {
                currentStatusMarkers = currentStatusMarkers.replace(statusMarker, "").replace(/,{2,}/g, ',').replace(/^,|,$/g, '');
            }
            token.set("statusmarkers", currentStatusMarkers);
            sendDelayedChat('Buff Helper', `/w ${characterName} Removing ${buffName} from ${characterName}.`, 10);
            onDeactivate(character);
        } else {
            // Activate the buff
            let startRound = getRoundNumber();
            state.BuffHelper.activeBuffs[characterId][buffName] = { startRound: getRoundNumber(), duration: duration, imagesLeft: 0 };
            if (Array.isArray(statusMarker)) {
                // For buffs with multiple status markers, add the initial one
                let initialMarker = statusMarker[0]; // Assuming the first marker is the initial state
                currentStatusMarkers = currentStatusMarkers ? currentStatusMarkers + "," + initialMarker : initialMarker;
            } else {
                currentStatusMarkers = currentStatusMarkers ? currentStatusMarkers + "," + statusMarker : statusMarker;
            }
            token.set("statusmarkers", currentStatusMarkers);
            sendChat('Buff Helper', `/w ${characterName} Buffed ${characterName} with ${buffName} on round ${startRound} lasting ${duration} rounds.`);
            onActivate(character);
        }
    } else {
        sendChat('Buff Helper', `/w Niic Character not found for token ` + token.get('name'));
    }
}

// #endregion


// #region UTILITY FUNCTIONS TO SUPPORT THE SCRIPT

function getRoundNumber() {
    // Parse the turn order to find the current round number
    let turnOrderStr = Campaign().get("turnorder");
    // Check if the turn order string is empty or not set
    if (!turnOrderStr) {
        return 0;
    }
    let turnOrder = JSON.parse(turnOrderStr);
    let roundEntry = _.find(turnOrder, entry => entry.custom && entry.custom.toLowerCase().indexOf("round") !== -1);
    let roundNumber = roundEntry ? parseInt(roundEntry.pr) : 0;

    return roundNumber;
}

function findTokenByCharacterId(characterId) {
    // Find a token object given a character ID
    let tokens = findObjs({ type: 'graphic', represents: characterId });
    return tokens[0]; // Assuming the character has at least one token
}

function getFirstName(character) {
    fullName = character.get("name");
    return fullName.split(" ")[0];
}

function sendDelayedChat(sender, message, time) {
    setTimeout(function() {
        sendChat(sender, message);
    }, time);
}

function getBaseSpeed(character) {
    let speedAttribute = findObjs({ type: 'attribute', characterid: character.id, name: 'speed' })[0];
    if (!speedAttribute) {
        sendChat('Buff Helper', `/w ${getFirstName(character)} Error: Speed attribute not found for character ${getFirstName(character)}`);
    }

    return speedAttribute ? parseInt(speedAttribute.get('current')) || 0 : 0;
}


function bootsOfSpeedHelper(characterId, buffName, speedChange) {
    let shouldBeBuffed = getShouldGetBuffed(characterId, buffName);
    const order = state.BuffHelper.buffOrder[characterId] || [];
    const bootsIndex = order.findIndex(buff => buff.name === "Boots of Speed");
    const buffIndex = order.findIndex(buff => buff.name === buffName);
    
    // If the buff was activated before Boots of Speed, double the effect on deactivation
    if (bootsIndex !== -1 && buffIndex !== -1 && buffIndex < bootsIndex && shouldBeBuffed) {
        const doubledChange = speedChange * 2;
        sendDelayedChat('Buff Helper', `/w ${getCharacterName(characterId)} ${buffName} was activated before Boots of Speed. Adjusting speed change to ${doubledChange}`, 50);
        return doubledChange;
    }

    return speedChange; // Otherwise, return unchanged
}

function initializeBuffOrder(characterId) {
    state.BuffHelper.buffOrder[characterId] = state.BuffHelper.buffOrder[characterId] || [];

    (state.BuffHelper.buffsWithoutDuration[characterId] || []).forEach(buffName => {
        state.BuffHelper.buffOrder[characterId].push({ name: buffName, shouldGetBuffed: true });
    });

    Object.keys(state.BuffHelper.activeBuffs[characterId] || {}).forEach(buffName => {
        if(!state.BuffHelper.buffOrder[characterId].some(buffObj => buffObj.name === buffName)) {
            state.BuffHelper.buffOrder[characterId].push({ name: buffName, shouldGetBuffed: true });
        }
    });
}

function getCharacterName(characterId) {
    // Use `getObj` to find the character object by its ID
    let character = getObj('character', characterId);
    
    // If the character exists, retrieve and return its name property
    if (character) {
        return getFirstName(character);
    } else {
        // If not found, log an error or return a placeholder message
        sendChat('Buff Helper', `/w Niic Character with ID ${characterId} not found`);
        return 'Unknown Character';
    }
}

function getShouldGetBuffed(characterId, buffName) {
    let characterName = getCharacterName(characterId);
    let buffList = state.BuffHelper.buffOrder[characterId] || [];
    let buff = buffList.find(b => b.name === buffName);
    
    if (buff) {
        return buff.shouldGetBuffed;
    } else {
        sendChat('Buff Helper', `/w ${characterName} ${buffName} not found for ${characterName}`);
    }
}

function setShouldGetBuffed(characterId, buffName, newValue) {
    let characterName = getCharacterName(characterId);
    // Retrieve the array of buffs for the given character
    let buffs = state.BuffHelper.buffOrder[characterId] || [];
    let buffIndex = buffs.findIndex(b => b.name === buffName);

    if (buffIndex !== -1) {
        state.BuffHelper.buffOrder[characterId][buffIndex].shouldGetBuffed = newValue;
    } else {
        sendChat('Buff Helper', `/w ${characterName} Buff named ${buffName} not found for character ${characterName}`);
    }
}

function getBuffByName(characterId, buffName) {
    const buffs = state.BuffHelper.buffOrder[characterId] || [];
    return buffs.find(b => b.name === buffName) || null;
}

function getCleanPlayerName(who) {
    // Remove any trailing ' (GM)' if present
    return who.replace(/\s*\(GM\)\s*$/, '').trim();
}

function processMirrorImageHit(token, character) {
    let characterId = character.id;
    let characterName = getFirstName(character);
    if (state.BuffHelper.activeBuffs[characterId] && state.BuffHelper.activeBuffs[characterId]['Mirror Image']) {
        let imagesLeft = state.BuffHelper.activeBuffs[characterId]['Mirror Image']['imagesLeft'];
        imagesLeft--;
        if (imagesLeft > 0) {
            state.BuffHelper.activeBuffs[characterId]['Mirror Image']['imagesLeft'] = imagesLeft;
            let currentStatusMarkers = token.get('statusmarkers') || '';

            // Remove all number markers
            BUFF_STATUS_MARKER_MAP['Mirror Image'].forEach(marker => {
                currentStatusMarkers = currentStatusMarkers.replace(marker, '').replace(/,{2,}/g, ',').replace(/^,|,$/g, '');
            });

            // Add the new number marker based on imagesLeft
            let newMarker = null;
            if (imagesLeft === 2) {
                newMarker = NUMBER_2_STATUS;
            } else if (imagesLeft === 1) {
                newMarker = NUMBER_1_STATUS;
            }

            if (newMarker) {
                currentStatusMarkers = currentStatusMarkers ? currentStatusMarkers + ',' + newMarker : newMarker;
            }
            token.set('statusmarkers', currentStatusMarkers);

            sendDelayedChat('Buff Helper', `/w ${characterName} One of your mirror images was destroyed. You have ${imagesLeft} left.`, 100);
        } else {
            // No images left, deactivate the buff
            toggleBuffWithDuration(token, character, 'Mirror Image', BUFF_STATUS_MARKER_MAP['Mirror Image'], 10, activateMirrorImage, deactivateMirrorImage);
            sendDelayedChat('Buff Helper', `/w ${characterName} All your mirror images are destroyed. Mirror Image has ended.`, 100);
        }
    } else {
        sendDelayedChat('Buff Helper', `/w ${characterName} Mirror Image is not active.`, 100);
    }
}


//#endregion


// #region DEBUGGING STUFF

on('chat:message', function(msg) {
    if (msg.type === 'api') {
        // Remove all markers from selected token(s)
        if (msg.content === '!removemarkers') {
            if (msg.selected && msg.selected.length > 0) {
                _.each(msg.selected, function(obj) {
                    let token = getObj('graphic', obj._id);
                    if (token) {
                        token.set('statusmarkers', '');

                        let cleanName = getCleanPlayerName(msg.who);
                        sendChat('System', `/w "${cleanName}" All markers removed from the selected token.`);
                    }
                });
            } else {
                let cleanName = getCleanPlayerName(msg.who);
                sendChat('System', `/w "${cleanName}" No token selected.`);
            }
        }
        // Remove specific marker from selected token(s)
        else if (msg.content.startsWith('!removemarker ')) {
            let args = msg.content.split(' ');
            if (args.length >= 2) {
                let markerName = args.slice(1).join(' ').trim();
                if (msg.selected && msg.selected.length > 0) {
                    _.each(msg.selected, function(obj) {
                        let token = getObj('graphic', obj._id);
                        if (token) {
                            removeMarkerFromToken(token, markerName);
                            let cleanName = getCleanPlayerName(msg.who);
                            sendChat('System', `/w "${cleanName}" Marker "${markerName}" removed from the selected token.`);
                        }
                    });
                } else {
                    let cleanName = getCleanPlayerName(msg.who);
                    sendChat('System', `/w "${cleanName}" No token selected.`);
                }
            } else {
                let cleanName = getCleanPlayerName(msg.who);
                sendChat('System', `/w "${cleanName}" Usage: !removemarker <markername>`);
            }
        }
        // Get markers from selected token
        else if (msg.content === '!getmarkers') {
            if (msg.selected && msg.selected.length > 0) {
                _.each(msg.selected, function(obj) {
                    let token = getObj('graphic', obj._id);
                    if (token) {
                        let tokenName = token.get('name') || 'Unnamed Token';
                        let statusMarkers = token.get('statusmarkers') || '';
                        let cleanName = getCleanPlayerName(msg.who);
                        sendChat('System', `/w "${cleanName}" Token "${tokenName}" (ID: ${token.id}) has status markers: ${statusMarkers}`);
                    }
                });
            } else {
                let cleanName = getCleanPlayerName(msg.who);
                sendChat('System', `/w "${cleanName}" No token selected.`);
            }
        }
    }
});

// Helper function to remove a specific marker from a token
function removeMarkerFromToken(token, markerName) {
    let statusMarkers = token.get('statusmarkers') || '';
    let markersArray = statusMarkers.split(',').filter(marker => marker !== '');
    markersArray = markersArray.filter(marker => marker !== markerName);
    token.set('statusmarkers', markersArray.join(','));
}

// Used to reset state if needed
on('chat:message', function(msg) {
    if (msg.type === 'api' && playerIsGM(msg.playerid)) {
        if (msg.content === '!buffhelper-reset') {
            state.BuffHelper = {
                version: CURRENT_VERSION
            };
            sendChat('Buff Helper', '/w GM Buff Helper state has been reset.');
        }
    }
});


// #endregion

// #region Mirror Image shenanigans
on('chat:message', function(message) {
    if(message.type === "api" && !message.content.startsWith('Buff Helper')) {
        let selected = message.selected;
        if(selected && selected.length > 0){
            _.each(selected, function(obj){
                let token = getObj("graphic", obj._id);
                if(token){
                    let characterId = token.get("represents");
                    let character = getObj("character", characterId);

                    if (message.content.indexOf("!mirrorroll") !== -1) {
                        mirrorImageRoll(token, character);
                    }
                }
            });
        } else {
            if (message.content.indexOf("!mirrorroll") !== -1) {
                sendChat('Buff Helper', `/w ${characterName} Please select a token.`);
            }
        }
    }
});

// Function to handle Mirror Image roll
function mirrorImageRoll(token, character) {
    let characterId = character.id;
    let characterName = getFirstName(character);
    let nameForChat = character.get("name");

    // Get the character's Dexterity modifier
    let dexModAttribute = findObjs({ type: 'attribute', characterid: characterId, name: 'dexterity_mod' })[0];
    let dexMod = dexModAttribute ? parseInt(dexModAttribute.get('current')) : 0;
    let imageAC = 10 + dexMod;

    // Check if Mirror Image is active
    if (state.BuffHelper.activeBuffs[characterId] && state.BuffHelper.activeBuffs[characterId]['Mirror Image']) {
        let imagesLeft = state.BuffHelper.activeBuffs[characterId]['Mirror Image']['imagesLeft'];

        // Determine the minimum roll needed based on images left
        let minRoll;
        if (imagesLeft === 3) {
            minRoll = 6;
        } else if (imagesLeft === 2) {
            minRoll = 8;
        } else if (imagesLeft === 1) {
            minRoll = 11;
        } else {
            sendChat('Buff Helper', `/w ${characterName} ${characterName} has no mirror images left.`);
            return;
        }

        // Build the roll template message
        let rollTemplate = `&{template:5e-shaped} `;
        rollTemplate += `{{title=Mirror Image}} `;
        rollTemplate += `{{subheader=Mirror Image Check}} `;
        rollTemplate += `{{text=Each time a creature targets you with an attack during the spell’s duration, roll a d20 to determine whether the attack instead targets one of your duplicates.

        If you have three duplicates, you must roll a 6 or higher to change the attack’s target to a duplicate. With two duplicates, you must roll an 8 or higher. With one duplicate, you must roll an 11 or higher.

        A duplicate’s AC equals 10 + your Dexterity modifier. If an attack hits a duplicate, the duplicate is destroyed. A duplicate can be destroyed only by an attack that hits it. It ignores all other damage and effects. The spell ends when all three duplicates are destroyed.

        A creature is unaffected by this spell if it can’t see, if it relies on senses other than sight, such as blindsight, or if it can perceive illusions as false, as with truesight.}} `
        rollTemplate += `{{Images left=${imagesLeft}

        **DC:** ${minRoll}
        **Roll:** [[1d20]]

        **On Success:** One of the Mirror Images takes the hit.
        }} `
        rollTemplate += `{{freetext=**On Failure:** ${characterName} takes the hit  
        
        **Image AC:** [[@{${nameForChat}|dexterity_mod}[Dex] + 10]] 
        }}`;

        // Send the message to chat, visible to all players
        sendChat(`${nameForChat}`, rollTemplate);

    } else {
        sendChat('Buff Helper', `/w ${characterName} ${characterName} does not have Mirror Image active.`);
    }
}

// #endregion