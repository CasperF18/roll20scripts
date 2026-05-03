on('ready', function() {
    // Build a map from marker names to marker tags (ids)
    var markerMap = {};
    var markers = JSON.parse(Campaign().get('token_markers'));
    markers.forEach(function(marker) {
        markerMap[marker.name.toLowerCase()] = marker.tag;
    });

    on('chat:message', function(msg) {
        // Check if the message is an API command starting with !h or !height
        if (msg.type === 'api' && (msg.content.startsWith('!h ') || msg.content.startsWith('!height '))) {
            var args = msg.content.split(' ');
            if (args.length < 2) return;
            var height = parseInt(args[1], 10);
            if (isNaN(height) || height % 5 !== 0) {
                sendChat('System', '/w "' + getCleanPlayerName(msg.who) + '" Please enter a number divisible by 5.');
                return;
            }
            if (!msg.selected || msg.selected.length === 0) {
                sendChat('System', '/w "' + getCleanPlayerName(msg.who) + '" Please select one or more tokens.');
                return;
            }
            if (height > 300 || height < -300) {
                sendChat('System', '/w "' + getCleanPlayerName(msg.who) + '" Valid height range is -300 to 300.');
                return;
            }

            if (height === 0) {
                msg.selected.forEach(function(sel) {
                    var token = getObj(sel._type, sel._id);
                    if (token && token.get('subtype') === 'token') {
                        removeHeightMarkers(token, markerMap);
                    }
                });
                return;
            }

            // Determine marker name based on positive or negative height
            var absHeight = Math.abs(height);
            var markerName = '';
            if (height > 0) {
                markerName = 'Up ' + absHeight + ' Feet';
            } else {
                markerName = 'Down ' + absHeight + ' Feet';
            }

            var markerTag = markerMap[markerName.toLowerCase()];
            if (!markerTag) {
                sendChat('System', '/w "' + getCleanPlayerName(msg.who) + '" No token marker found for height ' + height + '.');
                return;
            }

            // Apply the marker to the selected tokens
            msg.selected.forEach(function(sel) {
                var token = getObj(sel._type, sel._id);
                if (token && token.get('subtype') === 'token') {
                    removeHeightMarkers(token, markerMap);
                    token.set('status_' + markerTag, true);
                }
            });
        }
    });

    // Function to remove existing height markers from a token
    function removeHeightMarkers(token, markerMap) {
        var currentMarkers = token.get('statusmarkers').split(',');
        var heightMarkerTags = [];

        var heightMarkerRegex = /^(Up|Down) \d+ Feet$/;

        // Collect all height markers
        for (var name in markerMap) {
            if (heightMarkerRegex.test(name)) {
                heightMarkerTags.push(markerMap[name]);
            }
        }

        var newMarkers = currentMarkers.filter(function(marker) {
            return !heightMarkerTags.includes(marker);
        });
        token.set('statusmarkers', newMarkers.join(','));
    }

    // Function to clean the player's name (removing "(GM)" if present)
    function getCleanPlayerName(who) {
        return who.replace(/\s*\(GM\)/, '').trim();
    }
});
