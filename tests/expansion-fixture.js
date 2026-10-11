// Original synthetic stories; source rules supplied locally by the runner.
import {createPower} from '../src/core.js';
export function expansionCases(entries){const cases=[
  {
    "name": "太始天（完整版，择一开启））",
    "sections": 4,
    "story": "太始天主世界当前为洞天福地，主世界内历已确认三百年，当前时速外界一比一百，南谷局部一比一千。千年改设资格未到；局部岁月不计入主世界资格。南谷青禾族仍有十二人，已建立灌溉体系。北仓现存灵米三袋，此前两袋已交付外界。开天神通山河护身已经永久归于你，源流改设后仍保留。",
    "rows": [
      [
        "environment",
        "太始天主世界",
        "active",
        {
          "location": "太始天",
          "conditions": "洞天福地"
        },
        "world",
        {
          "stage": "洞天福地",
          "clock": "主世界内历三百年",
          "rates": "主世界外界一比一百；南谷局部一比一千",
          "reset": "资格未到；局部岁月不计入"
        }
      ],
      [
        "population",
        "南谷青禾族",
        "active",
        {
          "scale": "十二人",
          "location": "南谷"
        },
        "inhabitants",
        {
          "location": "南谷",
          "scale": "十二人",
          "achievements": "已建立灌溉体系"
        }
      ],
      [
        "record",
        "北仓灵米",
        "active",
        {
          "description": "现存三袋，两袋此前已交付"
        },
        "available",
        {
          "current": "现存三袋",
          "location": "北仓",
          "use": "此前两袋已交付外界"
        }
      ],
      [
        "skill",
        "山河护身",
        "active",
        {
          "effect": "开天神通，永久归身"
        },
        "growth",
        {
          "kind": "开天神通",
          "retained": "已经永久归于你，源流改设后仍保留"
        }
      ]
    ]
  },
  {
    "name": "文明之光系统",
    "sections": 3,
    "story": "文明之光系统中，北城共同体由你持续治理，当前文明阶段仍为初生阶段。北城夜校已落实教师和课堂，正在进行首期教学，尚未形成成熟复制方法。北城尚未进入黄金时代，不能预支文明反馈。",
    "rows": [
      [
        "record",
        "北城共同体",
        "active",
        {
          "description": "持续治理，初生阶段"
        },
        "communities",
        {
          "territory": "北城共同体，由你持续治理",
          "stage": "初生阶段"
        }
      ],
      [
        "research",
        "北城夜校",
        "working",
        {
          "progress": "首期教学中"
        },
        "projects",
        {
          "goal": "北城夜校教学",
          "basis": "已落实教师和课堂",
          "progress": "正在进行首期教学，尚未形成成熟复制方法"
        }
      ]
    ]
  },
  {
    "name": "至高亡灵主宰",
    "sections": 4,
    "story": "至高亡灵主宰的直属成员白骨哨长，原身份与巡防经历保留，核心尚存，形体战损后正在复生，仍是原成员。北垒军团实际新增富余三缕已回流给你，此前五缕是旧收益，不重复回流。北垒军团驻扎的西隘已形成死域，覆盖西隘营地。",
    "rows": [
      [
        "member",
        "白骨哨长",
        "active",
        {
          "condition": "核心尚存，正在复生"
        },
        "members",
        {
          "origin": "直属成员",
          "state": "形体战损，核心尚存，正在复生",
          "history": "原身份与巡防经历保留"
        }
      ],
      [
        "record",
        "北垒军团反哺",
        "active",
        {
          "description": "本期实际新增三缕回流"
        },
        "feedback",
        {
          "origin": "北垒军团",
          "received": "新增三缕已回流；此前五缕为旧收益"
        }
      ],
      [
        "environment",
        "西隘死域",
        "active",
        {
          "location": "西隘营地"
        },
        "domains",
        {
          "location": "覆盖西隘营地",
          "garrison": "北垒军团实际驻扎形成"
        }
      ]
    ]
  },
  {
    "name": "万界网购",
    "sections": 4,
    "story": "万界网购青灯订单正常成交价十点，会员实际支付七点已付款，所有权已转移，灯仍暂存，尚未领取。青灯只有这一盏，领取不会再次扣款。此前授权的青石收购委托目标三块、总价不超过九点，目前只已交付一块。云舟只是已收藏关注目标，尚未购买。",
    "rows": [
      [
        "record",
        "青灯订单",
        "active",
        {
          "description": "已付款，暂存，未领取"
        },
        "orders",
        {
          "item": "青灯一盏",
          "terms": "正常成交价十点，会员实际价七点",
          "payment": "实际支付七点已付款",
          "ownership": "所有权已转移，仍暂存，尚未领取",
          "progress": "待领取"
        }
      ],
      [
        "record",
        "暂存青灯",
        "active",
        {
          "description": "同一青灯，暂存未领取"
        },
        "assets",
        {
          "origin": "青灯订单",
          "quantity": "一盏",
          "location": "暂存，尚未领取"
        }
      ],
      [
        "record",
        "青石收购委托",
        "working",
        {
          "description": "目标三块，实际已交付一块"
        },
        "mandates",
        {
          "authorization": "此前已授权",
          "target": "青石三块",
          "limits": "总价不超过九点",
          "progress": "实际已交付一块"
        }
      ],
      [
        "record",
        "云舟收藏目标",
        "planned",
        {
          "description": "关注目标，尚未购买"
        },
        "targets",
        {
          "target": "云舟",
          "known": "尚未购买"
        }
      ]
    ]
  },
  {
    "name": "熟练度状态栏",
    "sections": 2,
    "story": "熟练度状态栏的踏风步目前LV2（35/100），已经获得轻身特性。今日实练后只产生落足重心的新理解，没有新增熟练度。追踪踏风步突破的练习已经开始，融合飞行仍未形成，不算已有新技能。",
    "rows": [
      [
        "skill",
        "踏风步",
        "active",
        {
          "effect": "轻身",
          "limits": "飞行未形成"
        },
        "skills",
        {
          "level": "LV2（35/100）",
          "traits": "轻身特性",
          "history": "今日只有落足重心的新理解，没有新增熟练度",
          "connections": "融合飞行仍未形成"
        }
      ],
      [
        "research",
        "踏风步突破练习",
        "working",
        {
          "progress": "已经开始"
        },
        "training",
        {
          "target": "追踪踏风步突破",
          "progress": "今日实练，产生落足重心的新理解",
          "remaining": "融合飞行仍未形成"
        }
      ]
    ]
  },
  {
    "name": "神圣几何",
    "sections": 3,
    "story": "神圣几何肉体节点已经接入耐冲击特质，来自真实解析。护身三角构型连接肉体、灵魂、灵性节点，已经运转，效力为缓冲冲击。护身三角强化已经投入并消耗玄砂两份，连接方法可以复用，强化只完成第一阶段，仍欠灵性稳定环节。",
    "rows": [
      [
        "record",
        "肉体节点",
        "active",
        {
          "description": "已接入耐冲击特质"
        },
        "nodes",
        {
          "origin": "肉体本源，真实解析",
          "traits": "耐冲击特质",
          "connections": "护身三角构型"
        }
      ],
      [
        "skill",
        "护身三角构型",
        "active",
        {
          "effect": "缓冲冲击"
        },
        "structures",
        {
          "scope": "本源构型",
          "components": "肉体、灵魂、灵性节点",
          "cycle": "已运转，缓冲冲击"
        }
      ],
      [
        "research",
        "护身三角强化",
        "working",
        {
          "progress": "只完成第一阶段"
        },
        "projects",
        {
          "target": "护身三角强化",
          "inputs": "已投入并消耗玄砂两份",
          "reusable": "连接方法可以复用",
          "progress": "只完成第一阶段",
          "remaining": "尚欠灵性稳定环节"
        }
      ]
    ]
  }
];return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));}
export const expansionProposals=(c,index=1)=>c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));
