// Original synthetic stories; worldbook rules are supplied locally.
import {createPower} from '../src/core.js';
export function equipmentRealmsCases(entries){const cases=[
  {
    "name": "装备栏",
    "sections": 3,
    "story": "装备栏中云翼飞毯真正归你并已正式挂载。实体飞毯当前在北库；高速冲击、承载缓冲与飞行功能已永久归身，供能需要外部灵力输入。望远镜只是借用，只有识别，没有挂载或归身收益。飞毯侦测联动仍是拟定计划，尚未统合。",
    "rows": [
      [
        "record",
        "云翼飞毯",
        "active",
        {
          "description": "真正归你，已正式挂载；北库；真实取得"
        },
        "equipment",
        {
          "state": "真正归你，已正式挂载",
          "location": "北库",
          "origin": "真实取得"
        }
      ],
      [
        "record",
        "云翼飞毯归身三属性",
        "active",
        {
          "description": "高速冲击；承载缓冲；飞行；云翼飞毯已正式挂载；外部灵力输入；永久归身"
        },
        "attributes",
        {
          "attack": "高速冲击",
          "defense": "承载缓冲",
          "functions": "飞行",
          "origin": "云翼飞毯已正式挂载",
          "inputs": "外部灵力输入",
          "retained": "永久归身"
        }
      ],
      [
        "record",
        "飞毯侦测联动",
        "planned",
        {
          "description": "仍是拟定计划，尚未统合"
        },
        "integrations",
        {
          "progress": "仍是拟定计划，尚未统合"
        }
      ]
    ]
  },
  {
    "name": "拓印",
    "sections": 3,
    "story": "拓印模式回风剑意已有十印，当前原版基准是新接触的同结构强剑意，原十印保留。本次释放十印后仍有十印，同一次显现的反复描述没有新增印数。此前顿悟状态已结束，期间取得的阵理新理解保留。回风剑意本次防御只削减部分冲击，未抵消部分仍作用于你。",
    "rows": [
      [
        "record",
        "回风剑意",
        "active",
        {
          "description": "十印，释放后仍十印；新接触的同结构强剑意；行为模式，剑意；真实接触，同一次显现反复描述不增印"
        },
        "patterns",
        {
          "count": "十印，释放后仍十印",
          "baseline": "新接触的同结构强剑意",
          "nature": "行为模式，剑意",
          "origin": "真实接触，同一次显现反复描述不增印"
        }
      ],
      [
        "record",
        "此前顿悟状态调用",
        "active",
        {
          "description": "已经结束；顿悟状态；期间取得的阵理新理解保留"
        },
        "states",
        {
          "state": "已经结束",
          "pattern": "顿悟状态",
          "retained": "期间取得的阵理新理解保留"
        }
      ],
      [
        "record",
        "回风防御记录",
        "active",
        {
          "description": "回风剑意，调用十印；本次实际防御；削减部分冲击，未抵消部分仍作用于你"
        },
        "actions",
        {
          "pattern": "回风剑意，调用十印",
          "event": "本次实际防御",
          "result": "削减部分冲击，未抵消部分仍作用于你"
        }
      ]
    ]
  },
  {
    "name": "赋能",
    "sections": 3,
    "story": "赋能已对北桥险战结算：本应取得一份灵力成长，最终百倍价值已经成立，当前只承接三成，七成待兑现。伤损已抹除，并留下岩击抗性一次；岩击抗性不再次翻倍。北桥守卫目标仍未完成，不能因损伤抹除记成功。",
    "rows": [
      [
        "record",
        "北桥险战结算",
        "active",
        {
          "description": "北桥险战，本应一份灵力成长与伤损；最终百倍价值已经成立；伤损抹除，岩击抗性一次，不再翻倍；守卫目标仍未完成"
        },
        "events",
        {
          "origin": "北桥险战，本应一份灵力成长与伤损",
          "positive": "最终百倍价值已经成立",
          "negative": "伤损抹除，岩击抗性一次，不再翻倍",
          "state": "守卫目标仍未完成"
        }
      ],
      [
        "record",
        "岩击抗性",
        "active",
        {
          "description": "已归身岩击抗性；北桥险战一次逆境补偿"
        },
        "benefits",
        {
          "benefit": "已归身岩击抗性",
          "origin": "北桥险战一次逆境补偿"
        }
      ],
      [
        "record",
        "北桥灵力待兑现",
        "working",
        {
          "description": "只承接三成，七成待兑现；北桥险战已成立百倍结果；已交付三成，七成尚待承接"
        },
        "pending",
        {
          "state": "只承接三成，七成待兑现",
          "origin": "北桥险战已成立百倍结果",
          "content": "已交付三成，七成尚待承接"
        }
      ]
    ]
  },
  {
    "name": "完美融合",
    "sections": 3,
    "story": "完美融合以霜刃为主体投入烈晶两枚，烈晶已全部转入霜刃结构，不再独立存在。融合仍在持续重构，稳定形成冷热分层刃，最终能量循环尚未完成。霜刃已成阶段可用，但不能记完整最终产物。",
    "rows": [
      [
        "record",
        "霜刃本轮融合",
        "working",
        {
          "description": "持续重构；霜刃主体；烈晶两枚已投入；冷热分层刃已稳定可用；最终能量循环尚未完成"
        },
        "projects",
        {
          "state": "持续重构",
          "subject": "霜刃主体",
          "inputs": "烈晶两枚已投入",
          "stable": "冷热分层刃已稳定可用",
          "remaining": "最终能量循环尚未完成"
        }
      ],
      [
        "record",
        "霜刃",
        "active",
        {
          "description": "已成冷热分层刃，阶段可用；霜刃主体与烈晶两枚；冷热分层；最终能量循环尚未完成"
        },
        "products",
        {
          "current": "已成冷热分层刃，阶段可用",
          "origin": "霜刃主体与烈晶两枚",
          "modes": "冷热分层",
          "growth": "最终能量循环尚未完成"
        }
      ],
      [
        "record",
        "本轮烈晶",
        "active",
        {
          "description": "全部转入霜刃结构，不再独立存在；独立余量为零；霜刃本轮融合；烈晶核心性质保留于冷热分层刃"
        },
        "materials",
        {
          "state": "全部转入霜刃结构，不再独立存在",
          "remaining": "独立余量为零",
          "destination": "霜刃本轮融合",
          "value": "烈晶核心性质保留于冷热分层刃"
        }
      ]
    ]
  },
  {
    "name": "源堡",
    "sections": 4,
    "story": "源堡只保存了旧桥历史记录，尚未再现旧桥，也没有桥体收纳。客人阿陆已经实际进入源堡东庭，活动范围仅东庭，当前受到隐秘保护。东庭到北港的门已经建立并持续开放，后来查询历史记录没有再生成桥。",
    "rows": [
      [
        "record",
        "旧桥历史记录",
        "active",
        {
          "description": "旧桥；过去真实历史时点；已取得旧桥信息，尚未再现；后续查询没有生成桥"
        },
        "records",
        {
          "subject": "旧桥",
          "time": "过去真实历史时点",
          "content": "已取得旧桥信息，尚未再现",
          "changes": "后续查询没有生成桥"
        }
      ],
      [
        "record",
        "阿陆",
        "active",
        {
          "description": "已实际进入源堡；客人阿陆；活动范围仅东庭，受隐秘保护"
        },
        "assets",
        {
          "state": "已实际进入源堡",
          "identity": "客人阿陆",
          "scope": "活动范围仅东庭，受隐秘保护"
        }
      ],
      [
        "record",
        "东庭北港门",
        "active",
        {
          "description": "持续开放；源堡东庭至北港；真实已建立通道"
        },
        "arrangements",
        {
          "state": "持续开放",
          "scope": "源堡东庭至北港",
          "rules": "真实已建立通道"
        }
      ]
    ]
  },
  {
    "name": "知识荒野",
    "sections": 4,
    "story": "知识荒野已经理解蓝陶制造知识并保存文明档案，知识仍可调用。修订蓝陶图纸只是编辑记录，现存陶炉没有随之改造。阿岚已被信息化转移到西院并恢复现实形态，仍是同一人，原记忆人格延续，没有新生命。蓝陶工艺已传授给西院三名学徒，他们已理解并能运用。",
    "rows": [
      [
        "record",
        "蓝陶制造知识",
        "active",
        {
          "description": "已理解蓝陶制造知识；已保存文明档案；图纸修订只改记录，现存陶炉未改造"
        },
        "knowledge",
        {
          "content": "已理解蓝陶制造知识",
          "origin": "已保存文明档案",
          "growth": "图纸修订只改记录，现存陶炉未改造"
        }
      ],
      [
        "record",
        "阿岚",
        "active",
        {
          "description": "西院，已恢复现实形态；原对象信息化转移，非新构筑；同一人，原记忆人格延续；信息化转移与恢复，未新增生命"
        },
        "creations",
        {
          "state": "西院，已恢复现实形态",
          "nature": "原对象信息化转移，非新构筑",
          "identity": "同一人，原记忆人格延续",
          "history": "信息化转移与恢复，未新增生命"
        }
      ],
      [
        "record",
        "西院蓝陶传授",
        "active",
        {
          "description": "已传授，已理解并能运用；西院三名学徒；蓝陶工艺"
        },
        "transmission",
        {
          "state": "已传授，已理解并能运用",
          "recipients": "西院三名学徒",
          "content": "蓝陶工艺"
        }
      ]
    ]
  }
];return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));}
export const equipmentRealmsProposals=(c,index=1)=>c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));
