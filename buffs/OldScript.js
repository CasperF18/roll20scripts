// Ensure these matches the custom markers
const LONGSTRIDER_STATUS = 'LongstriderCF::6552891';
const BLADESONG_STATUS = 'BladesongCF::6552889';
const BLUR_STATUS = 'BlurCF::6552890';

let activeBuffs = {}; // Used to store buff's start round and duration

//EVENTS

on('chat:message', function(message) {
    // Check if the message is an API command and not from the script itself
    if(message.type === "api" && !message.content.startsWith('System')) {
        let selected = message.selected;
        if(selected && selected.length > 0){
            _.each(selected, function(obj){
                let token = getObj("graphic", obj._id);
                if(token){
                    let characterId = token.get("represents");
                    let character = getObj("character", characterId);

                    if(message.content.indexOf("!toggleLongstrider") !== -1) {
                        toggleBuff(token, character, LONGSTRIDER_STATUS, 'speed', 10, 'Longstrider');
                    }
                    else if(message.content.indexOf("!toggleBladesong") !== -1) {
                        toggleBladesong(token, character, BLADESONG_STATUS);
                    }
                    else if(message.content.indexOf("!toggleBlur") !== -1) {
                        toggleBlur(token, character, BLUR_STATUS);
                    }
                }
            });
        }
    }
});

on("change:campaign:turnorder", function() {
    let turnOrder = JSON.parse(Campaign().get("turnorder") || "[]");
    let currentRound = getRoundNumber();

    if (turnOrder.length > 0) {
        let currentTokenId = turnOrder[0].id; // Assuming the first element is the current token

        _.each(activeBuffs, function(buffDetails, characterId) {
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
                                // Deactivate the specific buff - REMEMBER TO UPDATE THIS FUNCTION IF NEW BUFFS ADDED!
                                deactivateBuff(token, character, buffName);
                                sendChat('System', `/w ${getFirstName(character)} ${details.duration} rounds have passed and it's ${getFirstName(character)}'s turn. Deactivating ${buffName}.`);
                            } else {
                                sendChat('System', `/w ${getFirstName(character)} Error: Active Token not found for character ID ${characterId}.`);
                            }
                        } else {
                            sendChat('System', `/w ${getFirstName(character)} Error: Character not found for character ID ${characterId}.`);
                        }

                        // Remove the buff from activeBuffs
                        delete activeBuffs[characterId][buffName];
                    }
                }
            });
        });
    }
});


// SPECIFIC BUFF TOGGLES

function toggleBladesong(token, character, statusMarker) {
    let duration = 10;
    let characterName = getFirstName(character);

    toggleBuffWithDuration(token, character, 'Bladesong', statusMarker, duration);

    // Update the status marker check after toggling the buff
    let currentStatusMarkers = token.get("statusmarkers");
    let isMarkerActive = currentStatusMarkers.includes(statusMarker);

    if (character) {
        // Handling Armor Class adjustment
        modifyAttributeByAnother(character, 'AC', 'intelligence_mod', isMarkerActive);

        // Handling Speed adjustment
        modifyAttribute(character, 'speed', 10, isMarkerActive);
        
    } else {
        sendChat('System', `/w ${characterName} Character not found for token ` + token.get('name'));
    }
}

function toggleBlur(token, character, statusMarker) {
    let duration = 10;
    let characterName = getFirstName(character);

    toggleBuffWithDuration(token, character, 'Blur', statusMarker, duration);

    let currentStatusMarkers = token.get("statusmarkers");
    let isMarkerActive = currentStatusMarkers.includes(statusMarker);


    // Doesn't change anything, so just added some text
    if (character) {
        if (isMarkerActive) {
            sendDelayedChat('System', `/w ${characterName} Enemies have disadvantage on Attack Rolls against you.`)
        } else {
            sendDelayedChat('System', `/w ${characterName} Enemies no longer have disadvantage on Attack Rolls against you.`)
        }
    }
}


// BASIC FUNCTIONS

function modifyAttribute(character, attributeName, valueChange, shouldAdd) {
    let attribute = findObjs({ type: 'attribute', characterid: character.id, name: attributeName })[0];
    if (attribute) {
        let characterName = getFirstName(character);
        let currentValue = parseInt(attribute.get('current')) || 0;
        let newValue = shouldAdd ? currentValue + valueChange : currentValue - valueChange;
        attribute.set('current', newValue);
        sendDelayedChat('System', `/w ${characterName} ${attributeName.charAt(0).toUpperCase() + attributeName.slice(1)} is now: ` + newValue);
    } else {
        sendChat('System', `/w ${characterName} Attribute ` + attributeName + ' not found for character');
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
        sendDelayedChat('System', `/w ${characterName} ${baseAttributeName.charAt(0).toUpperCase() + baseAttributeName.slice(1)} is now: ` + newValue);
    } else {
        sendChat('System', `/w ${characterName} Attribute ` + baseAttributeName + ' or ' + modifierAttributeName + ' not found for character');
    }
}


function toggleBuff(token, character, statusMarker, attributeName, valueChange, buffName) {
    // Get current status markers of the token
    let currentStatusMarkers = token.get("statusmarkers");
    let characterName = getFirstName(character);
    
    // Check if the specific buff's status marker is currently active
    let isMarkerActive = currentStatusMarkers.includes(statusMarker);
    
    // Toggling the status marker
    let newStatusMarkers;
    if (isMarkerActive) {
        // If marker is active, remove it
        newStatusMarkers = currentStatusMarkers.replace(statusMarker, "").replace(/,{2,}/g, ',').replace(/^,|,$/g, '');
        sendChat('System', `/w ${characterName} Removing ${buffName} from ${characterName}.`);
    } else {
        // If marker is not active, add it
        newStatusMarkers = currentStatusMarkers ? currentStatusMarkers + "," + statusMarker : statusMarker;
        sendChat('System', `/w ${characterName} Buffed ${characterName} with ${buffName}.`);
    }

    // Update the token's status markers
    token.set("statusmarkers", newStatusMarkers);

    // Proceed to update the character attribute
    if (character) {
        modifyAttribute(character, attributeName, valueChange, !isMarkerActive);
    } else {
        sendChat('System', '/w Niic Character not found for token ' + token.get('name'));
    }
}

function toggleBuffWithDuration(token, character, buffName, statusMarker, duration) {
    let characterId = character.id;
    let characterName = getFirstName(character);
    let currentStatusMarkers = token.get("statusmarkers");
    let isMarkerActive = currentStatusMarkers.includes(statusMarker);

    activeBuffs[characterId] = activeBuffs[characterId] || {};

    if (isMarkerActive) {
        // Deactivate the buff
        delete activeBuffs[characterId][buffName];
        token.set("statusmarkers", currentStatusMarkers.replace(statusMarker, "").replace(/,{2,}/g, ',').replace(/^,|,$/g, ''));
        sendDelayedChat('System', `/w ${characterName} Removing ${buffName} from ${characterName}.`);
    } else {
        // Activate the buff
        let startRound = getRoundNumber();
        activeBuffs[characterId][buffName] = { startRound: getRoundNumber(), duration: duration };
        token.set("statusmarkers", currentStatusMarkers ? currentStatusMarkers + "," + statusMarker : statusMarker);
        sendChat('System', `/w ${characterName} Buffed ${characterName} with ${buffName} on round ${startRound} lasting ${duration} rounds.`)
    }
}

// Ducttape solution to spaghetti code. Ensures right toggle is called when deactivating buffs in the Turn Tracker Event Handler.
function deactivateBuff(token, character, buffName) {
    // Determine which toggle function to call based on the buffName
    switch (buffName) {
        case 'Bladesong':
            toggleBladesong(token, character, BLADESONG_STATUS);
            break;
        case 'Blur':
            toggleBlur(token, character, BLUR_STATUS);
            break;
        default:
            sendChat('System', '/w Niic No toggle function found for buff: ' + buffName);
            break;
    }
}

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

function sendDelayedChat(sender, message) {
    setTimeout(function() {
        sendChat(sender, message);
    }, 100);
}


