// Original synthetic stories; source worldbook remains local.
import {createPower} from '../src/core.js';
export function sixRealmsCases(entries){const cases=[
  {
    "name": "混沌海",
    "sections": 4,
    "story": "混沌海已创造眷属澄舟，现居青庭，负责实际研究雨水净化，原经历保留。青庭规则是保持温和雨季，已持续运行。净水环已完成创造并可用；本轮再次调整环形外观，仍是原来这一件，没有新造第二件，也没有主动指定牺牲代价。",
    "rows": [
      [
        "record",
        "澄舟",
        "active",
        {
          "description": "青庭，已创造眷属；实际新创造；原经历保留"
        },
        "creations",
        {
          "state": "青庭，已创造眷属",
          "nature": "实际新创造",
          "history": "原经历保留"
        }
      ],
      [
        "record",
        "青庭",
        "active",
        {
          "description": "已建立，持续运行；青庭；保持温和雨季"
        },
        "worlds",
        {
          "state": "已建立，持续运行",
          "environment": "青庭",
          "rules": "保持温和雨季"
        }
      ],
      [
        "record",
        "净水环",
        "active",
        {
          "description": "已完成创造并可用；此前实际创造；调整环形外观，仍是原来这一件"
        },
        "results",
        {
          "content": "已完成创造并可用",
          "origin": "此前实际创造",
          "growth": "调整环形外观，仍是原来这一件"
        }
      ]
    ]
  },
  {
    "name": "永暗之河",
    "sections": 4,
    "story": "永暗之河亡者青石已被接引，当前以亡灵形态住在西岸，生前记忆保留，尚未归还生者。青石第三年死亡烙印已保存在长河，外界尸体后来毁坏，已存烙印仍在。西岸梦院已经建立，现实身体沉眠而梦中可以学习，当前尚无新学习成果。",
    "rows": [
      [
        "record",
        "青石",
        "active",
        {
          "description": "已接引，亡灵形态，西岸，尚未归还生者；第三年死亡烙印；青石原人，生前记忆保留"
        },
        "residents",
        {
          "state": "已接引，亡灵形态，西岸，尚未归还生者",
          "basis": "第三年死亡烙印",
          "identity": "青石原人，生前记忆保留"
        }
      ],
      [
        "record",
        "青石第三年烙印",
        "active",
        {
          "description": "青石；第三年死亡；已取得死亡痕迹；长河已保存，外界尸体毁坏但烙印仍在"
        },
        "marks",
        {
          "subject": "青石",
          "time": "第三年死亡",
          "content": "已取得死亡痕迹",
          "state": "长河已保存，外界尸体毁坏但烙印仍在"
        }
      ],
      [
        "record",
        "西岸梦院",
        "active",
        {
          "description": "已经建立；西岸；现实身体沉眠，梦中可学习；当前尚无新学习成果"
        },
        "kingdom",
        {
          "state": "已经建立",
          "location": "西岸",
          "environment": "现实身体沉眠，梦中可学习",
          "results": "当前尚无新学习成果"
        }
      ]
    ]
  },
  {
    "name": "灾祸之城",
    "sections": 5,
    "story": "灾祸之城已直接确立北堡统治，北堡守军和粮仓保留，尚未打一场新的战争。镜界中北堡映像只是映像，不是新增守军。此前山火灾变已经终止，实际取得的暖炎势能保留，本轮只是查看，没有新影响和新反哺。",
    "rows": [
      [
        "record",
        "北堡统治",
        "active",
        {
          "description": "已直接确立统治；北堡及其守军；原守军与粮仓保留"
        },
        "conquests",
        {
          "state": "已直接确立统治",
          "scope": "北堡及其守军",
          "assets": "原守军与粮仓保留"
        }
      ],
      [
        "record",
        "北堡镜界映像",
        "active",
        {
          "description": "镜中映像，非新增军队；镜界对应北堡"
        },
        "mirrors",
        {
          "kind": "镜中映像，非新增军队",
          "state": "镜界对应北堡"
        }
      ],
      [
        "record",
        "山火暖炎势能",
        "active",
        {
          "description": "此前已终止山火灾变；实际取得暖炎势能；灾变结束后保留，本轮查看无新反哺"
        },
        "feedback",
        {
          "origin": "此前已终止山火灾变",
          "received": "实际取得暖炎势能",
          "retained": "灾变结束后保留，本轮查看无新反哺"
        }
      ]
    ]
  },
  {
    "name": "暗影世界",
    "sections": 4,
    "story": "暗影世界目标白鹿只承受了暗影影响，尚未正式归属，没有回归资格。已归属眷属夜萤核心痕迹保存在黑塔，外形毁灭后已重塑，仍是原夜萤，原记忆与侦察成长保留。旧井诅咒已从白鹿转至石铃，白鹿身上原异常解除，仍是同一份诅咒。",
    "rows": [
      [
        "record",
        "白鹿",
        "active",
        {
          "description": "仅受暗影影响，尚未正式归属；白鹿原对象；未建立回归关系"
        },
        "beings",
        {
          "state": "仅受暗影影响，尚未正式归属",
          "identity": "白鹿原对象",
          "core": "未建立回归关系"
        }
      ],
      [
        "record",
        "夜萤",
        "active",
        {
          "description": "已归属，外形毁灭后已重塑；原夜萤，原记忆与侦察成长保留；核心痕迹仍在黑塔"
        },
        "beings",
        {
          "state": "已归属，外形毁灭后已重塑",
          "identity": "原夜萤，原记忆与侦察成长保留",
          "core": "核心痕迹仍在黑塔"
        }
      ],
      [
        "record",
        "旧井诅咒",
        "active",
        {
          "description": "已转移，白鹿原异常解除；当前承接为石铃；原旧井诅咒；同一份诅咒从白鹿转至石铃"
        },
        "anomalies",
        {
          "state": "已转移，白鹿原异常解除",
          "target": "当前承接为石铃",
          "effect": "原旧井诅咒",
          "history": "同一份诅咒从白鹿转至石铃"
        }
      ]
    ]
  },
  {
    "name": "失序之国",
    "sections": 4,
    "story": "失序之国北院现行法令禁止未经许可离院，规则仍生效。阿青当前持有北院门禁使用权和独立藏书访问权，二者分别成立。只计划把门禁使用权转给阿澄，尚未执行；藏书访问权不在计划范围。",
    "rows": [
      [
        "record",
        "北院离院法令",
        "active",
        {
          "description": "仍生效；北院，未经许可离院；禁止未经许可离院"
        },
        "rules",
        {
          "state": "仍生效",
          "scope": "北院，未经许可离院",
          "effect": "禁止未经许可离院"
        }
      ],
      [
        "record",
        "北院门禁使用权",
        "active",
        {
          "description": "阿青；北院门禁使用；已授权使用资格；当前有效；转给阿澄仅计划，尚未执行"
        },
        "permissions",
        {
          "holder": "阿青",
          "scope": "北院门禁使用",
          "kind": "已授权使用资格",
          "state": "当前有效",
          "history": "转给阿澄仅计划，尚未执行"
        }
      ],
      [
        "record",
        "独立藏书访问权",
        "active",
        {
          "description": "阿青；藏书访问；独立授权；有效，不在门禁转移计划范围"
        },
        "permissions",
        {
          "holder": "阿青",
          "scope": "藏书访问",
          "kind": "独立授权",
          "state": "有效，不在门禁转移计划范围"
        }
      ]
    ]
  },
  {
    "name": "光之钥",
    "sections": 4,
    "story": "光之钥道标北港洪潮显示若连雨持续可能淹港，当前没有洪灾。已保存第三年旧轨迹，当时北港桥已毁，此记录不是当前现实。后来已实际回归第二年节点，当前北港桥完整，仅你的记忆被明确保留，其他人的经验没有一并保留。循环尚未建立，不能凭查看增加轮次。",
    "rows": [
      [
        "record",
        "北港洪潮道标",
        "active",
        {
          "description": "当前预警，尚未发生洪灾；北港洪潮；若连雨持续可能淹港"
        },
        "beacons",
        {
          "state": "当前预警，尚未发生洪灾",
          "subject": "北港洪潮",
          "future": "若连雨持续可能淹港"
        }
      ],
      [
        "record",
        "第三年旧轨迹",
        "active",
        {
          "description": "旧现实历史记录，非当前现实；第三年；当时北港桥已毁；仅保存作为旧轨迹"
        },
        "tracks",
        {
          "identity": "旧现实历史记录，非当前现实",
          "node": "第三年",
          "content": "当时北港桥已毁",
          "use": "仅保存作为旧轨迹"
        }
      ],
      [
        "record",
        "北港第二年回归",
        "active",
        {
          "description": "已实际完成回归；第二年节点；当前北港桥完整；仅你的记忆明确保留，其他人的经验未保留；第三年桥毁保留为旧轨迹，不是当前现实"
        },
        "interventions",
        {
          "state": "已实际完成回归",
          "target": "第二年节点",
          "current": "当前北港桥完整",
          "retained": "仅你的记忆明确保留，其他人的经验未保留",
          "history": "第三年桥毁保留为旧轨迹，不是当前现实"
        }
      ]
    ]
  }
];return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));}
export const sixRealmsProposals=(c,index=1)=>c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));
