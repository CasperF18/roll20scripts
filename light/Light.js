// === helpers ================================================================

function wrapDeg(d){ return ((d % 360) + 360) % 360; }
function numOrNull(v){ const n = parseFloat(v); return isNaN(n) ? null : n; }

function playerControls(token, playerid, isGM){
  let cbs = [];
  const tcb = token.get('controlledby');
  if (tcb) cbs = cbs.concat(tcb.split(','));
  const rep = token.get('represents');
  if (rep) {
    const ch = getObj('character', rep);
    if (ch) {
      const ccb = ch.get('controlledby');
      if (ccb) cbs = cbs.concat(ccb.split(','));
    }
  }
  cbs = [...new Set(cbs)];
  return isGM || cbs.includes(playerid) || cbs.includes('all');
}

function whisperConeControls(player){
  const name = player.get('_displayname');
  const panel = [
    `<div><b>Cone controls</b> (keep your token selected)</div>`,
    `[↺ 45](!cone -45) [↺ 15](!cone -15) [↻ 15](!cone +15) [↻ 45](!cone +45)`,
    `[Face token](!cone face) [Full circle](!cone full)`,
    `Angles: [60°](!cone angle 60) [90°](!cone angle 90) [120°](!cone angle 120)`
  ].join('<br>');
  sendChat('Cone', `/w "${name}" ${panel}`);
}

// === !cone ==================================================================

on('chat:message', function(msg){
  if (msg.type !== 'api' || !msg.content.startsWith('!cone')) return;

  const player = getObj('player', msg.playerid);
  if (!player) return;
  const isGM = playerIsGM(msg.playerid);
  const args = msg.content.trim().split(/\s+/).slice(1);
  const whisper = (s)=>sendChat('Cone', `/w "${player.get('_displayname')}" ${s}`);

  if (!msg.selected || msg.selected.length === 0){
    whisper(`Select a token you control, then try:<br> - <code>!cone</code> (opens buttons)<br> - <code>!cone +15</code> / <code>!cone -45</code><br> - <code>!cone face</code> / <code>!cone full</code><br> - <code>!cone set 135</code> / <code>!cone angle 60</code>`);
    return;
  }

  const sub = (args[0]||'').toLowerCase();
  const isRelative = /^[-+]\d+(\.\d+)?$/.test(sub);
  const isSet = sub === 'set' && args.length>=2 && numOrNull(args[1])!==null;
  const isAngle = sub === 'angle' && args.length>=2 && numOrNull(args[1])!==null;
  const isFace = sub === 'face';
  const isFull = sub === 'full';

  if (!isRelative && !isSet && !isAngle && !isFace && !isFull){
    whisperConeControls(player);
    return;
  }

  let changed = 0;
  let deniedNames = [];

  msg.selected.forEach(sel=>{
    const token = getObj(sel._type, sel._id);
    if (!token) return;
    if (!playerControls(token, msg.playerid, isGM)){
      deniedNames.push(token.get('name')||'Unnamed Token');
      return;
    }

    const update = {};

    const bright = parseFloat(token.get('bright_light_distance')) || 0;
    const low    = parseFloat(token.get('low_light_distance')) || 0;
    const hasBright = !!token.get('emits_bright_light') && bright > 0;
    const hasDim    = !!token.get('emits_low_light') && low > 0;

    const hasDirBright = !!token.get('has_directional_bright_light');
    const hasDirDim    = !!token.get('has_directional_dim_light');

    const centers = [
      parseFloat(token.get('directional_bright_light_center')),
      parseFloat(token.get('directional_dim_light_center')),
      parseFloat(token.get('rotation')) || 0
    ].filter(n=>!isNaN(n));
    let center = centers.length ? centers[0] : 0;

    if (isFull){
      update.has_directional_bright_light = false;
      update.has_directional_dim_light = false;
      update.directional_bright_light_total = '0';
      update.directional_dim_light_total = '0';
      update.directional_bright_light_center = '0';
      update.directional_dim_light_center = '0';
    }
    else if (isFace){
      const facing = parseFloat(token.get('rotation')) || 0;
      center = wrapDeg(facing);
      if (hasBright){
        update.has_directional_bright_light = true;
        update.directional_bright_light_center = center;
      }
      if (hasDim){
        update.has_directional_dim_light = true;
        update.directional_dim_light_center = center;
      }
    }
    else if (isRelative){
      const delta = numOrNull(sub);
      if (delta !== null){
        center = wrapDeg(center + delta);
        if (hasDirBright && hasBright){
          update.directional_bright_light_center = center;
        }
        if (hasDirDim && hasDim){
          update.directional_dim_light_center = center;
        }
      }
    }
    else if (isSet){
      const abs = wrapDeg(numOrNull(args[1]));
      center = abs;
      if (hasDirBright && hasBright){
        update.directional_bright_light_center = center;
      }
      if (hasDirDim && hasDim){
        update.directional_dim_light_center = center;
      }
    }
    else if (isAngle){
      const ang = Math.max(0, Math.min(360, numOrNull(args[1])));
      // Enable directional if 0<ang<360; otherwise full circle
      if (hasBright){
        update.has_directional_bright_light = ang>0 && ang<360;
        update.directional_bright_light_total = (ang>0 && ang<360) ? ang : '';
        if (ang>0 && ang<360) update.directional_bright_light_center = wrapDeg(center);
      }
      if (hasDim){
        update.has_directional_dim_light = ang>0 && ang<360;
        update.directional_dim_light_total = (ang>0 && ang<360) ? ang : '';
        if (ang>0 && ang<360) update.directional_dim_light_center = wrapDeg(center);
      }
    }

    if (Object.keys(update).length > 0){
      token.set(update);
      changed++;
    }
  });

  if (deniedNames.length > 0) whisper(`You don’t control: ${deniedNames.join(', ')}.`);
});

// === !light =================================================================

on('chat:message', function(msg){
  if (msg.type !== 'api' || !msg.content.startsWith('!light')) return;

  const player = getObj('player', msg.playerid);
  if (!player) return;
  const isGM = playerIsGM(msg.playerid);

  // Parse args: !light [bright] [dim] [angle?]
  let args = msg.content.trim().split(/\s+/);
  args.shift();
  args = args.filter(a=>a.trim()!=='');

  if (args.length === 0) {
    sendChat('System', `/w "${player.get('_displayname')}" Usage: !light [bright_radius] [dim_radius] [angle_degrees?] - If angle is omitted, full circle - 0<angle<360 = cone centered on token facing.`);
    return;
  }

  const brightRadius = args.length>=1 ? numOrNull(args[0]) : null;
  const dimRadius    = args.length>=2 ? numOrNull(args[1]) : null;
  const angleRaw     = args.length>=3 ? numOrNull(args[2]) : null;

  const brightRadiusValue = brightRadius !== null ? Math.max(0, brightRadius) : null;
  const dimRadiusValue    = dimRadius    !== null ? Math.max(0, dimRadius)    : null;
  const angleValueRaw     = angleRaw     !== null ? Math.max(0, Math.min(360, angleRaw)) : null;

  if (!msg.selected || msg.selected.length === 0) {
    sendChat('System', `/w "${player.get('_displayname')}" Please select a token you control.`);
    return;
  }

  const updatedTokens = [];
  const notUpdatedTokens = [];

  msg.selected.forEach(sel=>{
    const token = getObj(sel._type, sel._id);
    if (!token) return;

    if (!playerControls(token, msg.playerid, isGM)){
      notUpdatedTokens.push(token.get('name')||'Unnamed Token');
      return;
    }

    const update = {};

    // Existing distances
    const existingBright = parseFloat(token.get('bright_light_distance')) || 0;
    const existingLow    = parseFloat(token.get('low_light_distance')) || 0;
    let existingDimRadius = existingLow - existingBright;
    existingDimRadius = existingDimRadius > 0 ? existingDimRadius : 0;

    // Working values
    let newBright = existingBright;
    let newDim    = existingDimRadius;
    let newLow    = existingLow;

    // Bright
    if (brightRadiusValue !== null){
      newBright = brightRadiusValue;
      if (brightRadiusValue > 0){
        update.emits_bright_light = true;
        update.bright_light_distance = brightRadiusValue;
      } else {
        update.emits_bright_light = false;
        update.bright_light_distance = '0';
      }
    }

    // Dim (UDL: low_light_distance is total)
    if (dimRadiusValue !== null){
      newDim = dimRadiusValue;
      if (dimRadiusValue > 0){
        update.emits_low_light = true;
        newLow = newBright + dimRadiusValue;
        update.low_light_distance = newLow;
      } else {
        update.emits_low_light = false;
        update.low_light_distance = '0';
        newLow = newBright;
        newDim = 0;
      }
    } else if (brightRadiusValue !== null){
      newLow = newBright + newDim;
      if (newDim === 0){
        update.emits_low_light = false;
        update.low_light_distance = '0';
      } else {
        update.emits_low_light = true;
        update.low_light_distance = newLow;
      }
    }

    // Directional handling
    const facing = parseFloat(token.get('rotation')) || 0;

    const applyDirectional = (a) => {
      if (a === null) {
        // (Shouldn't happen now that we default to 360 when omitted)
        return;
      }
      if (a <= 0 || a >= 360) {
        // full circle — disable directional
        update.has_directional_bright_light = false;
        update.has_directional_dim_light = false;
        update.directional_bright_light_total = '';
        update.directional_dim_light_total = '';
        update.directional_bright_light_center = '';
        update.directional_dim_light_center = '';
      } else {
        // enable directional for any active light
        if ((update.emits_bright_light ?? (existingBright > 0)) && newBright > 0) {
          update.has_directional_bright_light = true;
          update.directional_bright_light_total = a;
          update.directional_bright_light_center = wrapDeg(facing);
        } else {
          update.has_directional_bright_light = false;
          update.directional_bright_light_total = '';
          update.directional_bright_light_center = '';
        }
        if ((update.emits_low_light ?? (existingLow > 0)) && newLow > newBright) {
          update.has_directional_dim_light = true;
          update.directional_dim_light_total = a;
          update.directional_dim_light_center = wrapDeg(facing);
        } else {
          update.has_directional_dim_light = false;
          update.directional_dim_light_total = '';
          update.directional_dim_light_center = '';
        }
      }
    };

    // Default to full circle when angle is omitted
    const angleToUse = (angleValueRaw === null) ? 360 : angleValueRaw;
    applyDirectional(angleToUse);

    if (Object.keys(update).length > 0) {
      token.set(update);
      updatedTokens.push({
        name: token.get('name') || 'Unnamed Token',
        bright: newBright,
        dim: newDim,
        totalDim: newLow,
        angle: (angleValueRaw === null)
          ? 'Full (360)'
          : (angleValueRaw <= 0 || angleValueRaw >= 360 ? 'Full (360)' : angleValueRaw)
      });
    } else {
      notUpdatedTokens.push(token.get('name') || 'Unnamed Token');
    }

    // Summary
    if (updatedTokens.length > 0) {
      if (updatedTokens.length === 1) {
        const t = updatedTokens[0];
        sendChat('System', `/w "${player.get('_displayname')}" Light updated for ${t.name}: Bright ${t.bright}, Dim ${t.dim} (Total ${t.totalDim}), Angle ${t.angle}.`);
      } else {
        const btxt = (brightRadiusValue !== null) ? brightRadiusValue : 'Unchanged';
        const dtxt = (dimRadiusValue !== null) ? dimRadiusValue    : 'Unchanged';
        const atxt = (angleValueRaw === null)
          ? 'Full (360)'
          : (angleValueRaw <= 0 || angleValueRaw >= 360 ? 'Full (360)' : angleValueRaw);
        sendChat('System', `/w "${player.get('_displayname')}" Light updated for ${updatedTokens.length} tokens with Bright ${btxt}, Dim ${dtxt}, Angle ${atxt}.`);
      }
    }

    if (notUpdatedTokens.length > 0) {
      if (notUpdatedTokens.length === 1) {
        sendChat('System', `/w "${player.get('_displayname')}" You do not control the token "${notUpdatedTokens[0]}".`);
      } else {
        sendChat('System', `/w "${player.get('_displayname')}" You do not control the following tokens: ${notUpdatedTokens.join(', ')}.`);
      }
    }


      // Auto-open cone controls if 0<angle<360 and we updated at least one token
      if (angleValueRaw !== null && angleValueRaw > 0 && angleValueRaw < 360 && updatedTokens.length > 0){
        whisperConeControls(player);
      }
    })
});
