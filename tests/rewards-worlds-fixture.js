// Original synthetic stories; local source worldbook is not distributed.
import {createPower} from '../src/core.js';
export function rewardsWorldsCases(entries){const cases=[
  {
    "name": "签到",
    "sections": 4,
    "story": "第三十个有效日程的日常签到已经结算，连续七天，累计三十天，奖励池强化，奖励倾向探索。旧塔首次抵达的场景签到此前已结算，本轮只重返旧塔，没有新意义，不重复发奖。旧塔地图已收入签到仓库，尚未领取。连续七天里程碑已达成并领取明灯术，累计三十天里程碑也已达成；二者是独立记录。",
    "rows": [
      [
        "record",
        "签到总览",
        "active",
        {
          "description": "第三十个有效日程，已结算；连续七天，累计三十天；强化池；探索"
        },
        "progress",
        {
          "period": "第三十个有效日程，已结算",
          "days": "连续七天，累计三十天",
          "pool": "强化池",
          "preference": "探索"
        }
      ],
      [
        "record",
        "旧塔首次场景签到",
        "active",
        {
          "description": "场景签到，旧塔首次抵达；此前旧塔首次抵达；旧塔地图已发；此前已结算，本轮重返无新意义"
        },
        "nodes",
        {
          "kind": "场景签到，旧塔首次抵达",
          "identity": "此前旧塔首次抵达",
          "reward": "旧塔地图已发",
          "state": "此前已结算，本轮重返无新意义"
        }
      ],
      [
        "record",
        "旧塔地图",
        "active",
        {
          "description": "旧塔首次场景签到；旧塔地图一份；已入仓，未领取；一份"
        },
        "warehouse",
        {
          "origin": "旧塔首次场景签到",
          "content": "旧塔地图一份",
          "state": "已入仓，未领取",
          "remaining": "一份"
        }
      ],
      [
        "record",
        "连续七天里程碑",
        "active",
        {
          "description": "连续七天；已达成；明灯术已领取；已兑现"
        },
        "milestones",
        {
          "condition": "连续七天",
          "progress": "已达成",
          "reward": "明灯术已领取",
          "state": "已兑现"
        }
      ],
      [
        "record",
        "累计三十天里程碑",
        "active",
        {
          "description": "累计三十天；已达成；已达成"
        },
        "milestones",
        {
          "condition": "累计三十天",
          "progress": "已达成",
          "state": "已达成"
        }
      ]
    ]
  },
  {
    "name": "抽奖系统",
    "sections": 4,
    "story": "抽奖系统当前为第二个个人日程，连续经历第一段24小时后旧日三次余奖已经自动抽取入库，再刷新五次，本日已用一次，剩四次。跨界改历法没有生成新日程。截雷盒已封存一道来袭雷击，尚未释放，仍持有一件且最后一步未完成。观技特权本轮重复抽中后进化，现在可信完整演示记录也可学习，仍为一项特权。截雷盒的封存行动正在等待释放，没有另获第二个盒子。",
    "rows": [
      [
        "record",
        "个人抽奖日程",
        "active",
        {
          "description": "第二个个人日程；四次；旧日三次自动抽取后刷新五次，本日用一次；跨界换历法没有新周期"
        },
        "schedule",
        {
          "period": "第二个个人日程",
          "remaining": "四次",
          "settled": "旧日三次自动抽取后刷新五次，本日用一次",
          "history": "跨界换历法没有新周期"
        }
      ],
      [
        "record",
        "截雷盒",
        "active",
        {
          "description": "盒子封存并释放一次来袭雷击；需真实来袭雷击；一件，尚未最终释放；已封存，仍持有；此前实际抽取"
        },
        "curios",
        {
          "rule": "盒子封存并释放一次来袭雷击",
          "activation": "需真实来袭雷击",
          "remaining": "一件，尚未最终释放",
          "state": "已封存，仍持有",
          "origin": "此前实际抽取"
        }
      ],
      [
        "record",
        "观技特权",
        "active",
        {
          "description": "亲眼观看及可信完整演示记录可学技艺；重复抽中新增可信完整记录作为学习依据；第二日已用的一次；已绑定，仍一项"
        },
        "privileges",
        {
          "effect": "亲眼观看及可信完整演示记录可学技艺",
          "growth": "重复抽中新增可信完整记录作为学习依据",
          "origin": "第二日已用的一次",
          "state": "已绑定，仍一项"
        }
      ],
      [
        "record",
        "截雷盒封存雷击",
        "working",
        {
          "description": "截雷盒；实际来袭雷击；已封存，尚未释放；等待释放"
        },
        "uses",
        {
          "tool": "截雷盒",
          "target": "实际来袭雷击",
          "result": "已封存，尚未释放",
          "state": "等待释放"
        }
      ]
    ]
  },
  {
    "name": "攻略系统",
    "sections": 5,
    "story": "钦慕者白鹤指定后当前好感四十，阶段逐渐熟悉；此前已领取10、20、30、40区间与20、40阶段奖励，下降到三十后回升四十没有再领奖，原现实旧友关系保留。此前四十区间得到的剑意仍归你，白鹤原剑意没有减少。恋爱点数全局当前十二点，本轮无收入。商城初级自愈体质八点已锁定，尚未购买，没有扣点也没有自愈能力。",
    "rows": [
      [
        "record",
        "白鹤关系",
        "active",
        {
          "description": "知性白鹤，现实旧友；40%，逐渐熟悉；下降30后回升40，旧阈值未重奖；已指定"
        },
        "people",
        {
          "identity": "知性白鹤，现实旧友",
          "affinity": "40%，逐渐熟悉",
          "events": "下降30后回升40，旧阈值未重奖",
          "state": "已指定"
        }
      ],
      [
        "record",
        "白鹤阈值记录",
        "active",
        {
          "description": "白鹤；区间10、20、30、40；阶段20、40；此前已发对应奖励；已领旧阈值，本轮无新奖"
        },
        "thresholds",
        {
          "target": "白鹤",
          "claimed": "区间10、20、30、40；阶段20、40",
          "rewards": "此前已发对应奖励",
          "state": "已领旧阈值，本轮无新奖"
        }
      ],
      [
        "record",
        "白鹤同源剑意",
        "active",
        {
          "description": "白鹤40%区间系统奖励；剑意；你持有，白鹤原能力保留"
        },
        "rewards",
        {
          "origin": "白鹤40%区间系统奖励",
          "content": "剑意",
          "state": "你持有，白鹤原能力保留"
        }
      ],
      [
        "record",
        "全局恋爱点数",
        "active",
        {
          "description": "十二点；本轮无新收入；本轮无成交"
        },
        "points",
        {
          "balance": "十二点",
          "income": "本轮无新收入",
          "spending": "本轮无成交"
        }
      ],
      [
        "record",
        "初级自愈体质商品",
        "active",
        {
          "description": "初级自愈体质，八点；已锁定，未成交；尚未获得自愈能力"
        },
        "shop",
        {
          "offer": "初级自愈体质，八点",
          "state": "已锁定，未成交",
          "result": "尚未获得自愈能力"
        }
      ]
    ]
  },
  {
    "name": "先祖投资人",
    "sections": 5,
    "story": "首次剑器类投资铁剑已经复制给第一老祖，当前原铁剑保留，首次剑器类别资格已使用。铁剑史线独立从原祖史演算，老祖曾建立青堡，后来青堡毁灭，只有守山剑法真正传至当代。当前家族是守山门后裔，已经继承守山剑法；青堡不是当前资产。青堡遗书已有真实传承依据但尚未在当代找到，仍待落实。其他投资不能自动得到这条史线的青堡。",
    "rows": [
      [
        "record",
        "首次铁剑投资",
        "active",
        {
          "description": "自有铁剑一柄；剑器类首次资格已使用；复制完整版本，原铁剑保留；第一老祖守山年代；已投，已反馈"
        },
        "investments",
        {
          "asset": "自有铁剑一柄",
          "category": "剑器类首次资格已使用",
          "cost": "复制完整版本，原铁剑保留",
          "landing": "第一老祖守山年代",
          "state": "已投，已反馈"
        }
      ],
      [
        "record",
        "铁剑独立史线",
        "active",
        {
          "description": "首次铁剑投资，从原祖史开始；老祖建青堡，后来青堡毁灭；守山剑法延续当代；青堡失落，仅历史；已形成报告"
        },
        "histories",
        {
          "investment": "首次铁剑投资，从原祖史开始",
          "events": "老祖建青堡，后来青堡毁灭",
          "outcome": "守山剑法延续当代",
          "lost": "青堡失落，仅历史",
          "state": "已形成报告"
        }
      ],
      [
        "record",
        "当前家族来路",
        "active",
        {
          "description": "守山门后裔；当代家族名分；铁剑史线实际承接；原记忆经历能力保留"
        },
        "lineage",
        {
          "identity": "守山门后裔",
          "relations": "当代家族名分",
          "sources": "铁剑史线实际承接",
          "retained": "原记忆经历能力保留"
        }
      ],
      [
        "record",
        "守山剑法继承",
        "active",
        {
          "description": "守山剑法；铁剑史线，世代保存；当代已经继承；当前有效一份"
        },
        "inheritance",
        {
          "content": "守山剑法",
          "source": "铁剑史线，世代保存",
          "state": "当代已经继承",
          "versions": "当前有效一份"
        }
      ],
      [
        "record",
        "青堡遗书待落实",
        "working",
        {
          "description": "铁剑史线真实遗书传承线索；遗书尚未找到；当代实际寻得；待落实"
        },
        "pending",
        {
          "source": "铁剑史线真实遗书传承线索",
          "expected": "遗书尚未找到",
          "conditions": "当代实际寻得",
          "state": "待落实"
        }
      ]
    ]
  },
  {
    "name": "同时穿越",
    "sections": 5,
    "story": "青界修士之我目前受关注且联系正常，星界研究者之我正在实验室，两者同属一个自我，各有当地身份。青界之我已真实掌握焰心术并共享给所有自己，反复调用没有新增收入。青界独立容量100份，星界独立容量200份，共同上限已确认300份；当前青界存量80份，星界存量200份，青界施法没有扣星界。原星界铜镜已真实转移到青界修士，星界不再持有，只有原一件。诸界已开始合作研究铜镜阵法，尚未完成新阵法。",
    "rows": [
      [
        "record",
        "青界修士之我",
        "active",
        {
          "description": "青界，修士；当前视角，联系正常；已掌握焰心术"
        },
        "selves",
        {
          "world": "青界，修士",
          "view": "当前视角，联系正常",
          "experience": "已掌握焰心术"
        }
      ],
      [
        "record",
        "星界研究者之我",
        "active",
        {
          "description": "星界，研究者，实验室；联系正常，非当前视角；研究铜镜阵法"
        },
        "selves",
        {
          "world": "星界，研究者，实验室",
          "view": "联系正常，非当前视角",
          "direction": "研究铜镜阵法"
        }
      ],
      [
        "record",
        "共有焰心术",
        "active",
        {
          "description": "所有自己可实际使用焰心术；青界之我真实掌握；已共享，调用不重复入账"
        },
        "shared",
        {
          "content": "所有自己可实际使用焰心术",
          "origin": "青界之我真实掌握",
          "state": "已共享，调用不重复入账"
        }
      ],
      [
        "record",
        "诸我能量总账",
        "active",
        {
          "description": "青界独立100份，星界独立200份；共同上限300份，每我完整可用；青界80份，星界200份；本轮无主动援助"
        },
        "energy",
        {
          "sources": "青界独立100份，星界独立200份",
          "total": "共同上限300份，每我完整可用",
          "stocks": "青界80份，星界200份",
          "transfers": "本轮无主动援助"
        }
      ],
      [
        "record",
        "跨界铜镜",
        "active",
        {
          "description": "铜镜原一件；原星界研究者持有；青界修士持有，星界已无此镜；已实际星界转青界，未复制"
        },
        "items",
        {
          "content": "铜镜原一件",
          "origin": "原星界研究者持有",
          "location": "青界修士持有，星界已无此镜",
          "history": "已实际星界转青界，未复制"
        }
      ],
      [
        "record",
        "铜镜阵法协作",
        "working",
        {
          "description": "青界与星界合作研究铜镜阵法；正在研究；已开始分工；尚无已完成新阵法"
        },
        "cooperation",
        {
          "goal": "青界与星界合作研究铜镜阵法",
          "state": "正在研究",
          "progress": "已开始分工",
          "result": "尚无已完成新阵法"
        }
      ]
    ]
  },
  {
    "name": "幻想具现",
    "sections": 5,
    "story": "天舟原型已凭古籍记载和明确飞航神话核心收入幻想录。天舟实体已具现并实际航行，现在受损停在北港，原型仍保留。你已通过真实航行掌握天舟操控本领，脱离船也保留。天舟与同一神话的星帆已实际联动增加航行稳定，目前持续生效。专属青帆天舟版本已经重构并永久保存，原典可切换；仅改名不另造独立新神话，本轮尚无独立新神话锚点。",
    "rows": [
      [
        "record",
        "天舟原型",
        "active",
        {
          "description": "古籍记载，明确飞航神话锚点；飞航效力；原典保留；已录入，实体受损不删"
        },
        "prototypes",
        {
          "source": "古籍记载，明确飞航神话锚点",
          "core": "飞航效力",
          "versions": "原典保留",
          "state": "已录入，实体受损不删"
        }
      ],
      [
        "record",
        "北港天舟实体",
        "active",
        {
          "description": "天舟原典；完整航行形态；北港；实体受损，原型仍保留"
        },
        "manifestations",
        {
          "prototype_ref": "天舟原典",
          "form": "完整航行形态",
          "location": "北港",
          "state": "实体受损，原型仍保留"
        }
      ],
      [
        "record",
        "天舟操控本领",
        "active",
        {
          "description": "真实天舟航行；匹配操控技艺；已沉淀为自身操控本领；脱离造物仍保留"
        },
        "skills",
        {
          "source": "真实天舟航行",
          "technique": "匹配操控技艺",
          "growth": "已沉淀为自身操控本领",
          "state": "脱离造物仍保留"
        }
      ],
      [
        "record",
        "天舟星帆联动",
        "active",
        {
          "description": "天舟与同神话星帆；航行稳定增强；当前持续生效"
        },
        "links",
        {
          "members": "天舟与同神话星帆",
          "effect": "航行稳定增强",
          "state": "当前持续生效"
        }
      ],
      [
        "record",
        "青帆天舟专属版本",
        "active",
        {
          "description": "专属版本，不是独立新神话；天舟原典与真实航行经历；青帆航行结构；原型专属重构来路，尚无独立新神话锚点；永久保存，原典可切换"
        },
        "exclusive",
        {
          "kind": "专属版本，不是独立新神话",
          "origin": "天舟原典与真实航行经历",
          "effect": "青帆航行结构",
          "anchor": "原型专属重构来路，尚无独立新神话锚点",
          "state": "永久保存，原典可切换"
        }
      ]
    ]
  }
];return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));}
export const rewardsWorldsProposals=(c,index=1)=>c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));
