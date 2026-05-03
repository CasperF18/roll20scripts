on("chat:message", function(msg) {
    if (msg.playerid === "API") return; // Ignore messages sent by the script itself

    log("Received chat message:", msg);

    let skillList = [
        "Acrobatics", "Animal Handling", "Arcana", "Athletics",
        "Deception", "History", "Insight", "Intimidation",
        "Investigation", "Medicine", "Nature", "Perception",
        "Performance", "Persuasion", "Religion", "Sleight of Hand",
        "Stealth", "Survival", "Thieves' tools", "Poisoner's kit"
    ];

    // Ensure message contains a valid skill name
    let detectedSkill = skillList.find(skill => new RegExp(`\\b${skill}\\b`, "i").test(msg.content));
    if (!detectedSkill) {
        return;
    }

    // Extract roll details
    let rollValue = null;
    let bonusSum = 0;
    let hasProficiency = false;
    let isDisadvantage = false;
    let isAdvantage = false;
    let isAdvantagePlus = false;
    let isDisadvantagePlus = false;

    if (msg.inlinerolls) {
        let rollDetails = msg.inlinerolls[0].results.rolls;
        let d20Rolls = [];

        for (let roll of rollDetails) {
            if (roll.type === "R" && roll.sides === 20) {
                d20Rolls = roll.results.map(r => r.v); // Store all d20 rolls
            }
        }

        // Detect different advantage/disadvantage types
        isAdvantage = msg.inlinerolls[0].expression.includes("2d20kh1");
        isDisadvantage = msg.inlinerolls[0].expression.includes("2d20kl1");
        isAdvantagePlus = msg.inlinerolls[0].expression.includes("3d20kh1");
        isDisadvantagePlus = msg.inlinerolls[0].expression.includes("3d20kl1");

        // Determine the roll value:
        if (d20Rolls.length > 0) {
            if (isDisadvantagePlus) {
                rollValue = Math.min(...d20Rolls); // Lowest of 3
            } else if (isAdvantagePlus) {
                rollValue = Math.max(...d20Rolls); // Highest of 3
            } else if (isDisadvantage) {
                rollValue = Math.min(...d20Rolls); // Lowest of 2
            } else if (isAdvantage) {
                rollValue = Math.max(...d20Rolls); // Highest of 2
            } else {
                rollValue = d20Rolls[0]; // Normal single roll
            }
        }

        // Extract bonuses from inline roll expression
        bonusSum = msg.inlinerolls[0].results.total - rollValue;

        // Check if the roll includes proficiency or expertise
        let rollExpression = msg.inlinerolls[0].expression;
        hasProficiency = rollExpression.includes("[proficient]") || rollExpression.includes("[expertise]");
    }

    if (rollValue === null) {
        return;
    }

    // Get character from player name
    let charId = findCharacterFromPlayer(msg.who);
    if (!charId) {
        return;
    }

    if (!hasProficiency) {
        return;
    }

    getAttrs(charId, ["reliable_talent", "output_option"], function(attrs) {
        let reliableTalent = parseInt(attrs.reliable_talent) || 0;
        let outputOption = attrs.output_option || ""; // Determines public/private roll

        // Only apply Reliable Talent when the raw d20 roll is below 10
        if (reliableTalent !== 1 || rollValue >= 10) {
            return; // Don't do anything
        }

        let adjustedRoll = 10;
        let finalRoll = adjustedRoll + bonusSum;

        // Fix GM Whisper Issue
        let whisperTargets = [];
        let sendToGM = false;
        let isWhisper = msg.type === "whisper"; // Check if the roll was a whisper

        if (isWhisper) {
            whisperTargets = [...msg.target_name];

            // Fix GM splitting issue ("G" and "M" should be "gm")
            if (whisperTargets.includes("G") && whisperTargets.includes("M")) {
                whisperTargets = whisperTargets.filter(t => t !== "G" && t !== "M"); // Remove G and M
                whisperTargets.push("gm"); // Add proper GM whisper
                sendToGM = true;
            } else {
                whisperTargets = whisperTargets.map(target => (target === "G" ? "gm" : target));
            }

            if (!whisperTargets.includes(msg.who)) {
                whisperTargets.push(msg.who);
            }
        }

        // Correct message format
        let formattedMessage = `&{template:5e-shaped} ` +
            `{{title=${detectedSkill} (Reliable Talent)}} ` +
            `{{Original=[[${rollValue}]] - The roll without modifiers.}} ` +
            `{{Adjusted=[[${finalRoll}]]}} ` +
            `{{note=Reliable Talent applied!}}`;

        // 📝 **Send Public Message if NOT a Whisper**
        if (!isWhisper) {
            sendChat(msg.who, formattedMessage);
        } else {
            // 📢 **Send message to the original player**
            sendChat(msg.who, `/w "${msg.who}" ${formattedMessage}`);

            // 📢 **Send message to the GM (only if it was a whisper to GM)**
            if (sendToGM) {
                sendChat(msg.who, `/w gm ${formattedMessage}`);
            }
        }
    });
});

// Helper function to get attributes
function getAttrs(charId, attrArray, callback) {
    let results = {};
    let remaining = attrArray.length;

    attrArray.forEach(attrName => {
        let attr = findObjs({ type: "attribute", characterid: charId, name: attrName })[0];
        results[attrName] = attr ? attr.get("current") : null;
        if (--remaining === 0) callback(results);
    });
}
    
function findCharacterFromPlayer(playerName) {
    let characters = findObjs({ type: "character" });
    for (let char of characters) {
        if (char.get("name").toLowerCase() === playerName.toLowerCase()) {
            return char.id;
        }
    }
    return null;
}
