// Transient UI state only. Never persisted to chat or sent to a model.
export class AIActivity {
  constructor(emit, { now = () => performance.now(), secret = () => '' } = {}) {
    this.emit = emit; this.now = now; this.secret = secret; this.current = null; this.sequence = 0;
  }
  publish(task) { this.emit({ ...task, elapsed: Math.max(0, (task.endedAt ?? this.now()) - task.startedAt) }); }
  cancel() {
    const task = this.current; if (!task) return;
    task.status = 'cancelled'; task.phase = '本次任务已取消'; task.endedAt = this.now();
    this.current = null; this.publish(task);
  }
  phase(message) { if (this.current) { this.current.phase = message; this.publish(this.current); } }
  warning(message) { if(this.current)this.current.warning=this.safe(message); }
  problem(message) { if (this.current) this.current.problem = this.safe(message); }
  safe(value) {
    let message = String(value || '请查看面板中的详细提示');
    const secrets=this.secret();for(const secret of Array.isArray(secrets)?secrets:[secrets])if(secret)message=message.split(secret).join('[已隐藏]');
    return message.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [已隐藏]').replace(/sk-[\w-]+/g, '[已隐藏]').slice(0, 240);
  }
  async run(label, work, outcome = () => '处理完成，请查看结果') {
    // Existing controllers reject concurrent requests. Nested model calls belong to this task.
    if (this.current) return work();
    const task = { id: ++this.sequence, label, phase: '准备中', status: 'running', startedAt: this.now() };
    this.current = task; this.publish(task);
    try {
      const result = await work();
      task.status = task.problem ? 'error' : task.warning ? 'partial' : 'success';
      task.phase = task.problem || task.warning || outcome();
      return result;
    } catch (error) {
      task.status = error?.name === 'AbortError' || /取消|窗口已关闭/.test(error?.message) ? 'cancelled' : 'error';
      task.phase = task.status === 'cancelled' ? '本次任务已取消' : this.safe(error?.message);
      throw error;
    } finally {
      if (this.current === task) { task.endedAt = this.now(); this.current = null; this.publish(task); }
    }
  }
}

export function installAIActivity(prototype) {
  const jobs = {
    draftArchiveCorrection: '拟定档案纠错', generateArchiveRecap: '回顾阶段成长', reviewArchives: '整理成果', reviewManagement: '核对管理记录', sceneActions: '生成场景建议',
    draftCreation: '拟定新内容', draftTerminal: '拟定终端安排', generate: '生成方案', sync: '核对正文状态',
    reviewStory: '核对正文承接', prepareSelectedRole: '准备变量写回',
  };
  for (const [name, title] of Object.entries(jobs)) {
    const original = prototype[name];
    if (typeof original !== 'function') continue;
    prototype[name] = function (...args) {
      this.aiActivity ||= new AIActivity(state => this.ui?.setAIActivity?.(state), { secret: () => [this.apiKey,...(this.requestSecrets||[])] });
      const power = this.store?.read?.()?.powers?.[args[0]?.powerId || this.powerId];
      const label = `${name === 'reviewArchives' && args[0]?.automatic ? '自动更新' : title}${power?.name ? ` · ${power.name}` : ''}`;
      if(this.aiActivity.current)return original.apply(this,args);
      return this.aiActivity.run(label, async () => {
        const ticket=this.runtimeLog?.begin(label,{powerId:power?.id,automatic:Boolean(args[0]?.automatic)}),previous=this.logTask;this.logTask=ticket;
        try{const result=await original.apply(this,args);this.runtimeLog?.finish(ticket,this.pendingArchiveReview?'待确认':'成功');return result;}
        catch(error){this.runtimeLog?.finish(ticket,error?.name==='AbortError'?'已取消':'失败',error?.message||String(error));throw error;}
        finally{if(this.logTask===ticket)this.logTask=previous;}
      }, () => {
        if (name === 'reviewArchives') return this.pendingArchiveReview ? '整理完成，等待确认' : args[0]?.autoSave ? '本批处理完成，请查看成果' : '本次检查完成';
        if (['draftCreation', 'draftTerminal', 'generate', 'reviewManagement', 'sync', 'sceneActions'].includes(name)) return '整理完成，请查看结果';
        return '本次处理完成';
      });
    };
  }
}
