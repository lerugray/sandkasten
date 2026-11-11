// candidate drawing bodies; g has white stroke/fill, round caps/joins; c = 32
const G = {
  airbase_old(g, c) {
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(c, c - 15); g.lineTo(c + 3, c - 6); g.lineTo(c + 15, c + 3); g.lineTo(c + 15, c + 7); g.lineTo(c + 3, c + 3);
    g.lineTo(c + 2, c + 11); g.lineTo(c + 7, c + 14); g.lineTo(c + 7, c + 16); g.lineTo(c, c + 14);
    g.lineTo(c - 7, c + 16); g.lineTo(c - 7, c + 14); g.lineTo(c - 2, c + 11); g.lineTo(c - 3, c + 3);
    g.lineTo(c - 15, c + 7); g.lineTo(c - 15, c + 3); g.lineTo(c - 3, c - 6); g.closePath(); g.fill(); g.stroke();
  },
  airbase_a(g, c) {
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(c, c - 14); g.lineTo(c + 2.4, c - 9.5); g.lineTo(c + 2.4, c - 4); g.lineTo(c + 13, c + 4); g.lineTo(c + 13, c + 7.2); g.lineTo(c + 2.4, c + 3.4);
    g.lineTo(c + 2.4, c + 8.6); g.lineTo(c + 6.2, c + 11.6); g.lineTo(c + 6.2, c + 13.8); g.lineTo(c, c + 12.4);
    g.lineTo(c - 6.2, c + 13.8); g.lineTo(c - 6.2, c + 11.6); g.lineTo(c - 2.4, c + 8.6); g.lineTo(c - 2.4, c + 3.4);
    g.lineTo(c - 13, c + 7.2); g.lineTo(c - 13, c + 4); g.lineTo(c - 2.4, c - 4); g.lineTo(c - 2.4, c - 9.5); g.closePath(); g.fill(); g.stroke();
  },
  airbase_b(g, c) {
    // thinner ring, same outer edge (23.5): the aircraft gets the room
    g.lineWidth = 3.5;
    g.beginPath(); g.arc(c, c, 21.75, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(c, c - 16); g.lineTo(c + 2.6, c - 11); g.lineTo(c + 2.6, c - 4.5); g.lineTo(c + 15, c + 4.5); g.lineTo(c + 15, c + 8); g.lineTo(c + 2.6, c + 3.6);
    g.lineTo(c + 2.6, c + 9.6); g.lineTo(c + 7, c + 13); g.lineTo(c + 7, c + 15.4); g.lineTo(c, c + 13.8);
    g.lineTo(c - 7, c + 15.4); g.lineTo(c - 7, c + 13); g.lineTo(c - 2.6, c + 9.6); g.lineTo(c - 2.6, c + 3.6);
    g.lineTo(c - 15, c + 8); g.lineTo(c - 15, c + 4.5); g.lineTo(c - 2.6, c - 4.5); g.lineTo(c - 2.6, c - 11); g.closePath(); g.fill(); g.stroke();
  },
  heliport_old(g, c) {
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(c - 8, c - 11); g.lineTo(c - 8, c + 11); g.moveTo(c + 8, c - 11); g.lineTo(c + 8, c + 11); g.moveTo(c - 8, c); g.lineTo(c + 8, c); g.stroke();
  },
  naval_base_old(g, c) {
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c - 17, 5, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(c, c - 12); g.lineTo(c, c + 19); g.moveTo(c - 10, c - 4); g.lineTo(c + 10, c - 4); g.stroke();
    g.beginPath(); g.arc(c, c + 4, 16, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  },
  port_old(g, c) {
    g.lineWidth = 5;
    g.strokeRect(c - 19, c - 19, 38, 38);
    g.beginPath();
    g.moveTo(c - 12, c - 4); g.quadraticCurveTo(c - 6, c - 11, c, c - 4); g.quadraticCurveTo(c + 6, c + 3, c + 12, c - 4);
    g.moveTo(c - 12, c + 8); g.quadraticCurveTo(c - 6, c + 1, c, c + 8); g.quadraticCurveTo(c + 6, c + 15, c + 12, c + 8);
    g.stroke();
  },
  port_a(g, c) {
    // the same square, a ship bow-on riding one wave
    g.lineWidth = 5;
    g.strokeRect(c - 19, c - 19, 38, 38);
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(c - 11, c - 3); g.lineTo(c + 11, c - 3); g.lineTo(c + 7, c + 5.5); g.lineTo(c - 7, c + 5.5); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.rect(c - 5, c - 11, 10, 5.5); g.fill(); g.stroke();
    g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(c - 12, c + 11.5); g.quadraticCurveTo(c - 6, c + 6.5, c, c + 11.5); g.quadraticCurveTo(c + 6, c + 16.5, c + 12, c + 11.5); g.stroke();
  },
  port_b(g, c) {
    // quay with a mooring bollard and a wave: the square frame opened into a basin
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(c - 19, c + 19); g.lineTo(c - 19, c - 19); g.lineTo(c + 19, c - 19); g.lineTo(c + 19, c + 19); g.stroke();
    g.lineWidth = 4.5;
    g.beginPath();
    g.moveTo(c - 12, c - 5); g.quadraticCurveTo(c - 6, c - 12, c, c - 5); g.quadraticCurveTo(c + 6, c + 2, c + 12, c - 5);
    g.moveTo(c - 12, c + 7); g.quadraticCurveTo(c - 6, c, c, c + 7); g.quadraticCurveTo(c + 6, c + 14, c + 12, c + 7);
    g.moveTo(c - 12, c + 19); g.quadraticCurveTo(c - 6, c + 12, c, c + 19); g.quadraticCurveTo(c + 6, c + 26, c + 12, c + 19);
    g.stroke();
  },
  port_c(g, c) {
    // same square; two clearer swells (longer period, heavier stroke)
    g.lineWidth = 5;
    g.strokeRect(c - 19, c - 19, 38, 38);
    g.lineWidth = 4.5;
    g.beginPath();
    g.moveTo(c - 11, c - 3); g.bezierCurveTo(c - 6, c - 12, c - 3, c - 12, c, c - 5.5); g.bezierCurveTo(c + 3, c + 1, c + 6, c + 1, c + 11, c - 8);
    g.moveTo(c - 11, c + 10); g.bezierCurveTo(c - 6, c + 1, c - 3, c + 1, c, c + 7.5); g.bezierCurveTo(c + 3, c + 14, c + 6, c + 14, c + 11, c + 5);
    g.stroke();
  },
  ad_old(g, c) {
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(c - 15, c + 15); g.lineTo(c + 15, c + 15); g.moveTo(c - 11, c + 9); g.lineTo(c + 10, c - 14); g.stroke();
    g.beginPath(); g.moveTo(c + 16, c - 18); g.lineTo(c + 3, c - 14); g.lineTo(c + 13, c - 5); g.closePath(); g.fill();
  },
  radar_old(g, c) {
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 5;
    g.beginPath(); g.arc(c - 4, c + 4, 16, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.beginPath(); g.moveTo(c - 4, c + 4); g.lineTo(c - 4, c + 17); g.stroke();
    g.lineWidth = 3.5;
    for (const r of [12, 20]) { g.beginPath(); g.arc(c - 8, c + 8, r + 8, -Math.PI * 0.42, -Math.PI * 0.08); g.stroke(); }
  },
  radar_a(g, c) {
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
    // dish: a filled bowl opening up and to the right, on a small tripod, with its feed and two wavefronts
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(c - 16, c - 5); g.quadraticCurveTo(c - 17, c + 14, c + 2, c + 13); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(c - 9, c + 9); g.lineTo(c - 13, c + 17); g.lineTo(c - 2, c + 17); g.closePath(); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(c - 7, c + 4); g.lineTo(c - 1, c - 2); g.stroke();
    g.beginPath(); g.arc(c - 0.5, c - 2.5, 2.8, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3.5;
    for (const r of [9.5, 17.5]) { g.beginPath(); g.arc(c - 0.5, c - 2.5, r, -Math.PI * 0.45, -Math.PI * 0.05); g.stroke(); }
  },
  radar_b(g, c) {
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
    // heavier dish stroke (open bowl), mast to a base line, one feed, two wavefronts
    g.lineWidth = 5;
    g.beginPath(); g.arc(c + 1, c - 4, 17, Math.PI * 0.5, Math.PI * 1.0); g.stroke();
    g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(c - 11, c + 8); g.lineTo(c - 11, c + 17); g.moveTo(c - 17, c + 17); g.lineTo(c - 4, c + 17); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(c - 11, c + 8); g.lineTo(c - 1, c - 2); g.stroke();
    g.beginPath(); g.arc(c - 0.5, c - 2.5, 2.8, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3.5;
    for (const r of [9.5, 17.5]) { g.beginPath(); g.arc(c - 0.5, c - 2.5, r, -Math.PI * 0.45, -Math.PI * 0.05); g.stroke(); }
  },
  nuclear_old(g, c) {
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, 19, a - Math.PI / 6, a + Math.PI / 6); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(c, c, 4, 0, Math.PI * 2); g.fill();
  },
};

G.airbase_c = function (g, c) {
  g.lineWidth = 5;
  g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(c, c - 14); g.lineTo(c + 2.5, c - 9); g.lineTo(c + 2.5, c - 4.5); g.lineTo(c + 13, c + 3.5); g.lineTo(c + 13, c + 7); g.lineTo(c + 2.5, c + 3.5);
  g.lineTo(c + 2.5, c + 8.5); g.lineTo(c + 6.5, c + 11.5); g.lineTo(c + 6.5, c + 13.5); g.lineTo(c, c + 12);
  g.lineTo(c - 6.5, c + 13.5); g.lineTo(c - 6.5, c + 11.5); g.lineTo(c - 2.5, c + 8.5); g.lineTo(c - 2.5, c + 3.5);
  g.lineTo(c - 13, c + 7); g.lineTo(c - 13, c + 3.5); g.lineTo(c - 2.5, c - 4.5); g.lineTo(c - 2.5, c - 9); g.closePath(); g.fill(); g.stroke();
};
G.radar_c = function (g, c) {
  g.lineWidth = 4;
  g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(c - 17, c - 6); g.quadraticCurveTo(c - 18, c + 15, c + 3, c + 14); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(c - 9, c + 9); g.lineTo(c - 13, c + 17); g.lineTo(c - 3, c + 17); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(c - 7, c + 4); g.lineTo(c - 0.5, c - 2.5); g.stroke();
  g.beginPath(); g.arc(c - 0.5, c - 2.5, 3, 0, Math.PI * 2); g.fill();
  g.lineWidth = 3.5;
  for (const r of [10, 18]) { g.beginPath(); g.arc(c - 0.5, c - 2.5, r, -Math.PI * 0.45, -Math.PI * 0.05); g.stroke(); }
};
G.radar_d = function (g, c) {
  // as c, one wavefront only and a heavier one
  g.lineWidth = 4;
  g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(c - 17, c - 6); g.quadraticCurveTo(c - 18, c + 15, c + 3, c + 14); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(c - 9, c + 9); g.lineTo(c - 13, c + 17); g.lineTo(c - 3, c + 17); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(c - 7, c + 4); g.lineTo(c + 0.5, c - 3.5); g.stroke();
  g.beginPath(); g.arc(c + 0.5, c - 3.5, 3.2, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4;
  for (const r of [14]) { g.beginPath(); g.arc(c - 1, c - 2, r, -Math.PI * 0.47, -Math.PI * 0.03); g.stroke(); }
};
G.port_d = function (g, c) {
  g.lineWidth = 5;
  g.strokeRect(c - 19, c - 19, 38, 38);
  g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(c - 6, c + 12); g.lineTo(c - 6, c - 11); g.moveTo(c - 12, c - 5); g.lineTo(c + 12, c - 11); g.moveTo(c - 12, c + 12); g.lineTo(c + 1, c + 12); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(c + 9, c - 10); g.lineTo(c + 9, c + 2); g.stroke();
  g.fillRect(c + 4.5, c + 2, 9, 6.5);
};
G.airbase_d = function (g, c) {
  g.lineWidth = 5;
  g.beginPath(); g.arc(c, c, 21, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(c, c - 14.5); g.lineTo(c + 2.8, c - 9.5); g.lineTo(c + 2.8, c - 4.8); g.lineTo(c + 13.5, c + 3.2); g.lineTo(c + 13.5, c + 6.6); g.lineTo(c + 2.8, c + 3.6);
  g.lineTo(c + 2.8, c + 8.4); g.lineTo(c + 6.5, c + 11.3); g.lineTo(c + 6.5, c + 13.5); g.lineTo(c, c + 12.2);
  g.lineTo(c - 6.5, c + 13.5); g.lineTo(c - 6.5, c + 11.3); g.lineTo(c - 2.8, c + 8.4); g.lineTo(c - 2.8, c + 3.6);
  g.lineTo(c - 13.5, c + 6.6); g.lineTo(c - 13.5, c + 3.2); g.lineTo(c - 2.8, c - 4.8); g.lineTo(c - 2.8, c - 9.5); g.closePath(); g.fill(); g.stroke();
};
const DOT = (g, c) => g.fillRect(c - 7.27, c - 7.27, 14.54, 14.54); // the 5 px true-position point at 22 px display
G.radar_old_dot = (g, c) => { G.radar_old(g, c); DOT(g, c); };
G.radar_c_dot = (g, c) => { G.radar_c(g, c); DOT(g, c); };
G.radar_e = function (g, c) {
  g.lineWidth = 4;
  g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
  // the feed sits on the symbol's centre, where an un-fanned site's true-position point lands
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(c - 19, c - 4); g.quadraticCurveTo(c - 19.5, c + 14.5, c - 1, c + 14); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(c - 12, c + 11); g.lineTo(c - 15.5, c + 17.5); g.lineTo(c - 6.5, c + 17.5); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(c - 10, c + 5); g.lineTo(c, c); g.stroke();
  g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
  g.lineWidth = 3.5;
  for (const r of [13, 20]) { g.beginPath(); g.arc(c, c, r, -Math.PI * 0.47, -Math.PI * 0.03); g.stroke(); }
};
G.radar_f = function (g, c) {
  g.lineWidth = 4;
  g.beginPath(); g.arc(c, c, 27, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(c - 19, c - 4); g.quadraticCurveTo(c - 19.5, c + 14.5, c - 1, c + 14); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(c - 12, c + 11); g.lineTo(c - 15.5, c + 17.5); g.lineTo(c - 6.5, c + 17.5); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(c - 10, c + 5); g.lineTo(c, c); g.stroke();
  g.beginPath(); g.arc(c, c, 3, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4.5;
  g.beginPath(); g.arc(c, c, 16.5, -Math.PI * 0.5, 0); g.stroke();
};
G.radar_e_dot = (g, c) => { G.radar_e(g, c); DOT(g, c); };
G.radar_f_dot = (g, c) => { G.radar_f(g, c); DOT(g, c); };
