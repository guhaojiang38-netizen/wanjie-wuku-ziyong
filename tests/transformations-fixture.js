// Original synthetic stories; no bundled source worldbook.
import {createPower} from '../src/core.js';
export function transformationsCases(entries){const cases=[
  {
    "name": "点石成金",
    "sections": 3,
    "story": "青铜剑已在青界完成第二次有效拔擢，现为灵剑，归属仍是你。青界序列已确认二转；刚改名为青锋不刷新次数。本轮因已到当前极致拒绝继续拔擢，没有第三转。剑身裂痕作为独立真实状态被拔擢为断裂，此为裂痕发展，不是修复青铜剑。",
    "rows": [
      [
        "record",
        "青铜剑",
        "active",
        {
          "description": "灵剑，青界当前极致；原青铜剑，现称青锋；仍归你所有"
        },
        "targets",
        {
          "state": "灵剑，青界当前极致",
          "origin": "原青铜剑，现称青锋",
          "retained": "仍归你所有"
        }
      ],
      [
        "record",
        "青铜剑青界序列",
        "active",
        {
          "description": "青铜剑；青界；已确认二转，提前封顶；改名和本轮拒绝不增加次数"
        },
        "sequences",
        {
          "target": "青铜剑",
          "framework": "青界",
          "count": "已确认二转，提前封顶",
          "history": "改名和本轮拒绝不增加次数"
        }
      ],
      [
        "record",
        "青铜剑裂痕",
        "active",
        {
          "description": "青铜剑剑身裂痕；裂痕演变为断裂；断裂，未修复"
        },
        "states",
        {
          "target": "青铜剑剑身裂痕",
          "direction": "裂痕演变为断裂",
          "state": "断裂，未修复"
        }
      ]
    ]
  },
  {
    "name": "上位替代",
    "sections": 3,
    "story": "你的巡航舟已选择并完成混合谱系替代，当前是星纹舟，原航海经验与归属保留。本次替代与发动机连带更新均属于同一轮，尚无新成长基准。星纹舟的另一路候选影舟只是保留方案，没有取得影舟能力。",
    "rows": [
      [
        "record",
        "巡航舟",
        "active",
        {
          "description": "混合谱系星纹舟，已经完成替代；仍归你；星纹航行；原航海经验保留"
        },
        "versions",
        {
          "state": "混合谱系星纹舟，已经完成替代",
          "ownership": "仍归你",
          "abilities": "星纹航行",
          "retained": "原航海经验保留"
        }
      ],
      [
        "record",
        "巡航舟保留候选",
        "ended",
        {
          "description": "巡航舟本轮基准；影舟路线未采用；已选星纹舟，影舟未获"
        },
        "candidates",
        {
          "target": "巡航舟本轮基准",
          "choices": "影舟路线未采用",
          "state": "已选星纹舟，影舟未获"
        }
      ],
      [
        "record",
        "巡航舟上位基准",
        "active",
        {
          "description": "巡航舟；本轮星纹舟；发动机更新仅为替代连带变化；尚无再次上位新基准"
        },
        "foundations",
        {
          "target": "巡航舟",
          "baseline": "本轮星纹舟",
          "growth": "发动机更新仅为替代连带变化",
          "state": "尚无再次上位新基准"
        }
      ]
    ]
  },
  {
    "name": "升变之印",
    "sections": 4,
    "story": "竹筷已真实升变为筷人，仍属你，原意识保留。随后观测竹筷守卫分支，锚点是原竹质与筷形，二级报价6点，未付款，目标仍为筷人。唯一免费槽挂入竹筷守卫，剧情已经等待2小时，总需6小时，尚未完成。此前兑换消耗100枚基础灵石获得1点；当前确认余额4点，此处查看不再兑换。",
    "rows": [
      [
        "record",
        "竹筷",
        "active",
        {
          "description": "已成为筷人；原竹质与筷形；原意识保留"
        },
        "forms",
        {
          "state": "已成为筷人",
          "anchor": "原竹质与筷形",
          "consciousness": "原意识保留"
        }
      ],
      [
        "record",
        "竹筷守卫分支",
        "planned",
        {
          "description": "当前筷人；竹筷守卫，原竹质与筷形锚点；二级6点；未付款，拟由免费槽完成"
        },
        "branches",
        {
          "target": "当前筷人",
          "branch": "竹筷守卫，原竹质与筷形锚点",
          "price": "二级6点",
          "state": "未付款，拟由免费槽完成"
        }
      ],
      [
        "record",
        "唯一免费槽",
        "working",
        {
          "description": "竹筷守卫；二级，总需6小时；剧情已等2小时，剩余4小时；已挂入，尚未完成"
        },
        "slot",
        {
          "task": "竹筷守卫",
          "grade": "二级，总需6小时",
          "progress": "剧情已等2小时，剩余4小时",
          "state": "已挂入，尚未完成"
        }
      ],
      [
        "record",
        "升变点账户",
        "active",
        {
          "description": "4点；此前100枚基础灵石；当地100枚基础灵石兑1点；此前兑换1点，本轮仅查看无新增"
        },
        "points",
        {
          "balance": "4点",
          "input": "此前100枚基础灵石",
          "basis": "当地100枚基础灵石兑1点",
          "change": "此前兑换1点，本轮仅查看无新增"
        }
      ]
    ]
  },
  {
    "name": "归我所有",
    "sections": 4,
    "story": "你已在猜拳中真实赢过白鹤，本人参与，默认复制白鹤剑术后即时改选为灵目，本场仅取得灵目一项，白鹤仍保有灵目。白鹤剑术未取。先前从松道人取得的眼力与这次灵目已整理为通明眼，独有夜视保留，同类不把强度直接相加。",
    "rows": [
      [
        "record",
        "白鹤猜拳胜利",
        "active",
        {
          "description": "本人参与且猜拳已胜；白鹤；即时改选为灵目，仅一项；已取得"
        },
        "victories",
        {
          "event": "本人参与且猜拳已胜",
          "opponents": "白鹤",
          "selection": "即时改选为灵目，仅一项",
          "state": "已取得"
        }
      ],
      [
        "record",
        "白鹤灵目",
        "active",
        {
          "description": "灵目完整能力；白鹤，本次猜拳胜利；即时改选替换默认剑术，白鹤仍保有灵目"
        },
        "gains",
        {
          "content": "灵目完整能力",
          "origin": "白鹤，本次猜拳胜利",
          "state": "即时改选替换默认剑术，白鹤仍保有灵目"
        }
      ],
      [
        "record",
        "白鹤对手档案",
        "active",
        {
          "description": "白鹤本人；灵目；剑术未取"
        },
        "opponents",
        {
          "identity": "白鹤本人",
          "taken": "灵目",
          "remaining": "剑术未取"
        }
      ],
      [
        "record",
        "通明眼",
        "active",
        {
          "description": "已成立综合眼力；松道人眼力与白鹤灵目；同类采用较强表现；保留夜视"
        },
        "fusions",
        {
          "state": "已成立综合眼力",
          "sources": "松道人眼力与白鹤灵目",
          "shared": "同类采用较强表现",
          "unique": "保留夜视"
        }
      ]
    ]
  },
  {
    "name": "等价交换",
    "sections": 3,
    "story": "以自有一枚砂砾按唯一数量尺度交换一枚赤宝石的交换已经成立，砂砾实际付出，赤宝石暂时不能交割，资格保留；当前没有赤宝石实体到手。另一笔以自有一枚石片按数量换得蓝宝石已交割，蓝宝石完整性质保留，本轮查看不重复获得。",
    "rows": [
      [
        "record",
        "赤宝石交换",
        "active",
        {
          "description": "自有一枚砂砾，实际已付出；唯一数量尺度，一枚对一枚；真实赤宝石一枚；已成立，暂未交割"
        },
        "exchanges",
        {
          "input": "自有一枚砂砾，实际已付出",
          "scale": "唯一数量尺度，一枚对一枚",
          "target": "真实赤宝石一枚",
          "state": "已成立，暂未交割"
        }
      ],
      [
        "record",
        "赤宝石暂存资格",
        "working",
        {
          "description": "赤宝石交换；赤宝石结果资格保留，实体未到手；暂不能交割；仍暂存"
        },
        "pending",
        {
          "exchange": "赤宝石交换",
          "entitlement": "赤宝石结果资格保留，实体未到手",
          "conditions": "暂不能交割",
          "state": "仍暂存"
        }
      ],
      [
        "record",
        "蓝宝石成果",
        "active",
        {
          "description": "蓝宝石已实际到手；此前一枚石片按数量交换；原完整宝石性质保留；本轮只查看，无新增"
        },
        "results",
        {
          "state": "蓝宝石已实际到手",
          "origin": "此前一枚石片按数量交换",
          "nature": "原完整宝石性质保留",
          "use": "本轮只查看，无新增"
        }
      ]
    ]
  },
  {
    "name": "生命球",
    "sections": 4,
    "story": "你已经识别星鲸定义，但从未化身，尚未入生命库。你曾亲自成为赤龙并觉醒焰心，当前已切换回人类，赤龙道路及觉醒保留。赤龙焰心已经熔铸进人类形态，源形态仍有焰心；人类焰心成果保存在人类档案。所有形态共享同一意识记忆人格，这次赤龙觉醒没有声明共同位格提升。",
    "rows": [
      [
        "record",
        "星鲸定义",
        "planned",
        {
          "description": "可靠生命信息识别；星鲸生命；未首次化身，尚未入生命库"
        },
        "definitions",
        {
          "origin": "可靠生命信息识别",
          "definition": "星鲸生命",
          "state": "未首次化身，尚未入生命库"
        }
      ],
      [
        "record",
        "赤龙生命道路",
        "active",
        {
          "description": "已经化身过，入库，当前非赤龙；龙体与焰心；赤龙焰心觉醒保留；源形态仍有焰心"
        },
        "forms",
        {
          "state": "已经化身过，入库，当前非赤龙",
          "structure": "龙体与焰心",
          "growth": "赤龙焰心觉醒保留",
          "features": "源形态仍有焰心"
        }
      ],
      [
        "record",
        "人类生命道路",
        "active",
        {
          "description": "当前化身人类，已经入库；人类稳定承载焰心；实际熔铸赤龙焰心"
        },
        "forms",
        {
          "state": "当前化身人类，已经入库",
          "structure": "人类稳定承载焰心",
          "features": "实际熔铸赤龙焰心"
        }
      ],
      [
        "record",
        "人类焰心熔铸",
        "active",
        {
          "description": "已得赤龙焰心；人类形态；人类稳定运行焰心；已完成，赤龙仍保有焰心"
        },
        "features",
        {
          "source": "已得赤龙焰心",
          "target": "人类形态",
          "effect": "人类稳定运行焰心",
          "state": "已完成，赤龙仍保有焰心"
        }
      ],
      [
        "record",
        "共同生命核心",
        "active",
        {
          "description": "所有形态同一意识记忆人格；当前经验连续；本次未确认共同位格提升"
        },
        "core",
        {
          "identity": "所有形态同一意识记忆人格",
          "growth": "当前经验连续",
          "rank": "本次未确认共同位格提升"
        }
      ]
    ]
  }
];return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));}
export const transformationsProposals=(c,index=1)=>c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));
