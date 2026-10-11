// Original synthetic stories; source rules remain local to the runner.
import {createPower} from '../src/core.js';
export function collectionsCases(entries){const cases=[
  {
    "name": "挂机",
    "sections": 4,
    "story": "挂机征伐之影在西原已经暂停，伤势恢复中，已有探索记录仍保留。铁羽甲实际取得后仍由影子穿用，受损，尚未调回，本体没有第二件。西原遗迹入口已发现，遗迹首通尚未完成。查看此次汇报没有产生新收益。",
    "rows": [
      [
        "record",
        "征伐之影",
        "active",
        {
          "description": "已暂停，伤势恢复中；西原；受损铁羽甲仍在用"
        },
        "shadow",
        {
          "state": "已暂停，伤势恢复中",
          "location": "西原",
          "configuration": "受损铁羽甲仍在用"
        }
      ],
      [
        "record",
        "铁羽甲",
        "active",
        {
          "description": "影子在用，受损，尚未调回；仅此一件；实际取得；尚未调回，本体没有第二件"
        },
        "assets",
        {
          "state": "影子在用，受损，尚未调回",
          "current": "仅此一件",
          "origin": "实际取得",
          "flow": "尚未调回，本体没有第二件"
        }
      ],
      [
        "record",
        "西原遗迹",
        "planned",
        {
          "description": "西原遗迹入口；首通遗迹；入口已发现，首通尚未完成"
        },
        "discoveries",
        {
          "location": "西原遗迹入口",
          "goal": "首通遗迹",
          "progress": "入口已发现，首通尚未完成"
        }
      ]
    ]
  },
  {
    "name": "图书馆",
    "sections": 4,
    "story": "图书馆馆藏原页焰息，来自对火卫的实际胜果，属于核心页。焰息装备在核心槽，当前没有其他书页装备。焰息训练副本已赐予阿青，副本被封禁，原页仍在馆内。阿青此前回流的控温新用法保留，个人剑术不属于回流。",
    "rows": [
      [
        "record",
        "焰息",
        "active",
        {
          "description": "核心页，焰息能力；对火卫的实际胜果；控温新用法；原页仍在馆内"
        },
        "pages",
        {
          "content": "核心页，焰息能力",
          "origin": "对火卫的实际胜果",
          "growth": "控温新用法",
          "state": "原页仍在馆内"
        }
      ],
      [
        "record",
        "当前书页搭配",
        "active",
        {
          "description": "核心：焰息；其他未装备；原页长期保留"
        },
        "loadout",
        {
          "equipped": "核心：焰息；其他未装备",
          "changes": "原页长期保留"
        }
      ],
      [
        "record",
        "阿青焰息训练副本",
        "active",
        {
          "description": "阿青；焰息训练副本；已封禁，原页仍在馆内；此前控温新用法，个人剑术不属于回流"
        },
        "copies",
        {
          "holder": "阿青",
          "page": "焰息训练副本",
          "state": "已封禁，原页仍在馆内",
          "feedback": "此前控温新用法，个人剑术不属于回流"
        }
      ]
    ]
  },
  {
    "name": "全知档案馆",
    "sections": 4,
    "story": "全知档案馆已经回答北港未来防洪问题：若上游持续暴雨且不加固堤坝，北港可能被淹，这是条件性未来，当前并未发生洪灾。你已授权尽有之灵修复北堤，已实际修复第一段，余段待完成。此前委托交付的净水手环已经适配并由你持有；询问手环没有再次交付一件。",
    "rows": [
      [
        "record",
        "北港防洪答案",
        "active",
        {
          "description": "北港未来防洪问题；条件性未来，当前并未发生洪灾；若上游持续暴雨且不加固堤坝，北港可能被淹"
        },
        "answers",
        {
          "question": "北港未来防洪问题",
          "identity": "条件性未来，当前并未发生洪灾",
          "answer": "若上游持续暴雨且不加固堤坝，北港可能被淹"
        }
      ],
      [
        "record",
        "北堤修复委托",
        "working",
        {
          "description": "你已授权修复北堤；已实际修复第一段；余段待完成"
        },
        "commissions",
        {
          "authorization": "你已授权修复北堤",
          "progress": "已实际修复第一段",
          "remaining": "余段待完成"
        }
      ],
      [
        "record",
        "净水手环",
        "active",
        {
          "description": "已交付并已适配；净水手环一件；此前委托交付；由你持有，询问没有再次交付"
        },
        "gains",
        {
          "state": "已交付并已适配",
          "content": "净水手环一件",
          "origin": "此前委托交付",
          "retained": "由你持有，询问没有再次交付"
        }
      ]
    ]
  },
  {
    "name": "模板",
    "sections": 4,
    "story": "模板已解锁精锐位格，真名守炬，主动特性火刃，真实基准保持原值，倍率没有递归写回。苍狼征服模板已由你的决定性胜利提炼，等效精锐，倍率一倍半，仅有已展现的嗅觉特性。当前个人精锐单阶段，搭载苍狼一枚，第二征服位置空置；当前总倍率只按正文确认记录为二点二五倍。",
    "rows": [
      [
        "record",
        "精锐位格",
        "active",
        {
          "description": "已解锁精锐；守炬；主动特性火刃；真实基准原值，倍率没有递归写回"
        },
        "personal",
        {
          "rank": "已解锁精锐",
          "name": "守炬",
          "traits": "主动特性火刃",
          "basis": "真实基准原值，倍率没有递归写回"
        }
      ],
      [
        "record",
        "苍狼征服模板",
        "active",
        {
          "description": "你的决定性胜利，已提炼；等效精锐，一倍半；已展现的嗅觉；长期收藏"
        },
        "conquests",
        {
          "origin": "你的决定性胜利，已提炼",
          "specification": "等效精锐，一倍半",
          "traits": "已展现的嗅觉",
          "state": "长期收藏"
        }
      ],
      [
        "record",
        "当前模板配置",
        "active",
        {
          "description": "精锐，一倍半；单阶段，一倍；苍狼一枚，第二位置空置；正文确认二点二五倍"
        },
        "loadout",
        {
          "personal": "精锐，一倍半",
          "phase": "单阶段，一倍",
          "equipped": "苍狼一枚，第二位置空置",
          "total": "正文确认二点二五倍"
        }
      ]
    ]
  },
  {
    "name": "万象神魔图录",
    "sections": 4,
    "story": "万象神魔图录正式原型星匠尚未征服，你在帷幕设计较量中中止，但确认了散热弱点，该情报保留，尚未获得星匠继承或战将。既有战将青岚在外遭毁后已经复归，仍是原战将，旧记忆保留，没有新增首次继承。",
    "rows": [
      [
        "record",
        "星匠原型",
        "active",
        {
          "description": "正式原型，尚未征服；设计与工程本领；已确认散热弱点"
        },
        "archetypes",
        {
          "state": "正式原型，尚未征服",
          "identity": "设计与工程本领",
          "knowledge": "已确认散热弱点"
        }
      ],
      [
        "record",
        "星匠设计挑战",
        "working",
        {
          "description": "帷幕星匠，设计较量；已中止；散热弱点情报保留，尚未征服"
        },
        "challenges",
        {
          "target": "帷幕星匠，设计较量",
          "progress": "已中止",
          "findings": "散热弱点情报保留，尚未征服"
        }
      ],
      [
        "record",
        "青岚",
        "active",
        {
          "description": "遭毁后已复归，仍是原战将；既有已征服原型；原记忆保留，没有新增首次继承"
        },
        "generals",
        {
          "state": "遭毁后已复归，仍是原战将",
          "origin": "既有已征服原型",
          "tasks": "原记忆保留，没有新增首次继承"
        }
      ]
    ]
  },
  {
    "name": "旅法师",
    "sections": 4,
    "story": "旅法师已经到达蓝泉位面北岸，北岸只有坐标记录，尚未主动锚定地印。炎谷地印此前已经锚定，持续提供地热法术力。火花空间地热区已实际产出暖石两块，一块已调出，现存一块。霜纹术式已经接触取得样本，尚未完成转译，不能当作可施展法术。",
    "rows": [
      [
        "record",
        "蓝泉北岸",
        "active",
        {
          "description": "已抵达，只有坐标，尚未锚定；蓝泉位面北岸"
        },
        "places",
        {
          "state": "已抵达，只有坐标，尚未锚定",
          "location": "蓝泉位面北岸"
        }
      ],
      [
        "record",
        "炎谷地印",
        "active",
        {
          "description": "此前已锚定；炎谷；地热法术力"
        },
        "places",
        {
          "state": "此前已锚定",
          "location": "炎谷",
          "support": "地热法术力"
        }
      ],
      [
        "record",
        "火花空间地热区",
        "active",
        {
          "description": "已形成地热区；炎谷地印；已产两块，一块调出，现存一块"
        },
        "space",
        {
          "environment": "已形成地热区",
          "sources": "炎谷地印",
          "production": "已产两块，一块调出，现存一块"
        }
      ],
      [
        "record",
        "霜纹术式样本",
        "working",
        {
          "description": "样本，尚未完成转译；实际接触取得样本；霜纹术式；尚不可施展"
        },
        "repertoire",
        {
          "state": "样本，尚未完成转译",
          "origin": "实际接触取得样本",
          "content": "霜纹术式",
          "use": "尚不可施展"
        }
      ]
    ]
  }
];return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));}
export const collectionsProposals=(c,index=1)=>c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));
