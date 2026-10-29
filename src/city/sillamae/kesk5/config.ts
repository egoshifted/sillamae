import type {Point2, Polygon} from '../../../engine/types.ts';

export const design = {
  "id": "213818453",
  "name": "Kesk 5",
  "family": "offset-slab",
  "stage": "plain-shape",
  "footprint": [
    [
      282.7,
      662
    ],
    [
      267.4,
      655.5
    ],
    [
      269.5,
      650.5
    ],
    [
      254.4,
      644.1
    ],
    [
      256.4,
      639.3
    ],
    [
      240.8,
      632.6
    ],
    [
      242.9,
      627.7
    ],
    [
      227.2,
      621
    ],
    [
      222.5,
      632
    ],
    [
      237.5,
      638.4
    ],
    [
      235.3,
      643.8
    ],
    [
      250.5,
      650.3
    ],
    [
      248.5,
      655
    ],
    [
      264.1,
      661.6
    ],
    [
      261.9,
      666.7
    ],
    [
      277.8,
      673.5
    ]
  ] as Polygon,
  "origin": [
    252.46250000000003,
    647.1250000000001
  ] as Point2,
  "floors": 5,
  "roofDatum": 16.5,
  "parapetHeight": 0.3,
  "baseHeight": 1,
  "floorPitch": 3.1,
  "wallThickness": 0.38,
  "windowSill": 0.8,
  "windowWidth": 1.55,
  "windowHeight": 1.5,
  "windowColumns": [
    0.12,
    0.31,
    0.69,
    0.88
  ],
  "stairWidth": 1.65,
  "doorWidth": 1.5,
  "entryHeight": 2.35,
  "canopyWidth": 2.1,
  "canopyDepth": 1.15,
  "loggiaDepth": 1.25,
  "loggiaParapet": 0.95,
  "ventWidth": 0.75,
  "ventDepth": 2.7,
  "ventHeight": 0.65,
  "roofVentLayout": [
    [
      0.37,
      2.1
    ],
    [
      0.52,
      2.1
    ],
    [
      0.32,
      7.3
    ]
  ],
  "facades": [
    {
      "edge": 6,
      "type": "entrance",
      "section": 1,
      "label": "NE entrance section 1",
      "projectingEnds": [
        "start",
        "end"
      ]
    },
    {
      "edge": 4,
      "type": "entrance",
      "section": 2,
      "label": "NE entrance section 2",
      "projectingEnds": [
        "start"
      ]
    },
    {
      "edge": 2,
      "type": "entrance",
      "section": 3,
      "label": "NE entrance section 3",
      "projectingEnds": [
        "start"
      ]
    },
    {
      "edge": 0,
      "type": "entrance",
      "section": 4,
      "label": "NE entrance section 4",
      "projectingEnds": [
        "start"
      ]
    },
    {
      "edge": 8,
      "type": "loggia",
      "section": 1,
      "label": "SW river loggia section 1",
      "projectingEnds": [
        "start"
      ]
    },
    {
      "edge": 10,
      "type": "loggia",
      "section": 2,
      "label": "SW river loggia section 2",
      "projectingEnds": [
        "start"
      ]
    },
    {
      "edge": 12,
      "type": "loggia",
      "section": 3,
      "label": "SW river loggia section 3",
      "projectingEnds": [
        "start"
      ]
    },
    {
      "edge": 14,
      "type": "loggia",
      "section": 4,
      "label": "SW river loggia section 4",
      "projectingEnds": [
        "start",
        "end"
      ]
    }
  ],
  "windowColumnWidths": [
    2.1,
    1.55,
    1.55,
    2.1
  ],
  "roofDividers": [
    {
      "id": "R12",
      "fromCorner": 5,
      "toCorner": 9,
      "width": 0.38,
      "height": 0.45
    },
    {
      "id": "R23",
      "fromCorner": 3,
      "toCorner": 11,
      "width": 0.38,
      "height": 0.45
    },
    {
      "id": "R34",
      "fromCorner": 1,
      "toCorner": 13,
      "width": 0.38,
      "height": 0.45
    }
  ],
  "sectionBoundaryGroups": [
    [
      5,
      6,
      9,
      10
    ],
    [
      3,
      4,
      11,
      12
    ],
    [
      1,
      2,
      13,
      14
    ]
  ],
  "roofEdgeThickness": 0.38,
  "landingWidth": 2.7,
  "facadeRelief": {
    "edgeWidth": 0.38,
    "edgeProjection": 0.22,
    "jambWidth": 0.25,
    "jambProjection": 0.16,
    "headHeight": 0.2,
    "baseDatum": -0.05
  },
  "sideParapetHeight": 0.45,
  "connectedWallFaces": true,
  "basement": {
    "columns": [
      0.12,
      0.88
    ],
    "width": 1.2,
    "sill": -0.3,
    "height": 0.9,
    "wallBase": -0.55,
    "wellDepth": 0.65,
    "wellMargin": 0.15,
    "wellWall": 0.12,
    "wellFloor": -0.45,
    "wellRim": 0.08
  },
  "foundationRecess": {
    "depth": 1.25,
    "pierWidth": 0.38
  },
  "rearEdgeProjection": 0.12,
  "roofBalconySetback": 1.2,
  "rearWindows": {
    "fractions": [
      0.1,
      0.3,
      0.5,
      0.7,
      0.9
    ],
    "widths": [
      1.45,
      1.65,
      1.45,
      1.45,
      1.65
    ],
    "height": 1.5,
    "bottomOffset": 1.05,
    "frameWidth": 0.065
  },
  "rearRoofLedge": {
    "projection": 0.05,
    "height": 0.08,
    "thickness": 0.38
  },
  "loggiaBaseHeight": 1.4,
  "topRearWindowBottomOffset": 0.65
};

export const balconySchedule = {
  "rows": [
    {
      "section": 1,
      "floor": 1,
      "segments": []
    },
    {
      "section": 1,
      "floor": 2,
      "segments": [
        {
          "from": 0.03,
          "to": 0.22,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 1,
      "floor": 3,
      "segments": [
        {
          "from": 0.04,
          "to": 0.92,
          "frame": "dark",
          "panePitch": 0.45
        }
      ]
    },
    {
      "section": 1,
      "floor": 4,
      "segments": [
        {
          "from": 0.04,
          "to": 0.6,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.84,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 1,
      "floor": 5,
      "segments": [
        {
          "from": 0.03,
          "to": 0.25,
          "frame": "light",
          "cover": "red",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 2,
      "floor": 1,
      "segments": [
        {
          "from": 0.78,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 2,
      "floor": 2,
      "segments": [
        {
          "from": 0.8,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 2,
      "floor": 3,
      "segments": [
        {
          "from": 0.04,
          "to": 0.25,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.79,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 2,
      "floor": 4,
      "segments": [
        {
          "from": 0.05,
          "to": 0.94,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 2,
      "floor": 5,
      "segments": [
        {
          "from": 0.8,
          "to": 0.97,
          "frame": "light",
          "cover": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 3,
      "floor": 1,
      "segments": [
        {
          "from": 0.08,
          "to": 0.6,
          "frame": "dark",
          "panePitch": 0.45
        },
        {
          "from": 0.79,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 3,
      "floor": 2,
      "segments": [
        {
          "from": 0.05,
          "to": 0.23,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.8,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 3,
      "floor": 3,
      "segments": [
        {
          "from": 0.05,
          "to": 0.24,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.7,
          "to": 0.96,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 3,
      "floor": 4,
      "segments": [
        {
          "from": 0.05,
          "to": 0.24,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.7,
          "to": 0.96,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 3,
      "floor": 5,
      "segments": [
        {
          "from": 0.66,
          "to": 0.96,
          "frame": "light",
          "cover": "dark",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 4,
      "floor": 1,
      "segments": [
        {
          "from": 0.04,
          "to": 0.3,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.73,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 4,
      "floor": 2,
      "segments": [
        {
          "from": 0.05,
          "to": 0.28,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.79,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 4,
      "floor": 3,
      "segments": [
        {
          "from": 0.04,
          "to": 0.24,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.78,
          "to": 0.97,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 4,
      "floor": 4,
      "segments": [
        {
          "from": 0.04,
          "to": 0.23,
          "frame": "light",
          "panePitch": 0.7
        },
        {
          "from": 0.7,
          "to": 0.96,
          "frame": "light",
          "panePitch": 0.7
        }
      ]
    },
    {
      "section": 4,
      "floor": 5,
      "segments": [
        {
          "from": 0.26,
          "to": 0.97,
          "frame": "light",
          "cover": "dark",
          "panePitch": 0.7
        }
      ]
    }
  ]
};
