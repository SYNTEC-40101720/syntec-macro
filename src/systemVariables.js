// systemVariables.js
// 系统变数固定编号语义表（hover 提示用，不做静态诊断）
// 依据：
// - docs/macro-handbook/02-variables.md §2.7.1（系统变数 bit 级规格 + G92 系统变数补遗）
// - docs/macro-handbook/02-variables.md §2.10（PLC↔系统变数映射）
// 维护规则：仅登记手册已明确编号的固定子集，不做整段 #1001~#5500 映射推断。

/**
 * 系统变数编号 → 语义说明（仅供 hover，不要在 validator 中据此 emit 诊断）。
 * 长度控制在 8 行内，避免 hover 弹窗过长。
 */
const SYSTEM_VARIABLE_DOCS = {
  // §2.7.1 控制系统变数 bit 级规格（与 #1500~#1820 区段）
  '#1500': '宁静模式（Silent Mode）\nbit0=1 启用：宏程序与 G/M 码动作隐藏输出、仅 Diagnostic 模式。\n版本门控：见 §2.5；无 Pr 强制条件。\n注意：#1500~#1820 为 Double 型态，Long/Double 混型的 MOD 会触发 COR-054。',
  '#1502': '单步执行（Macro Stepping）\nbit0=1 MACRO 单节单步运行；写入后每执行一节即暂停等待。\n版本门控：Pr3221=1 强制启用，可写不可关闭。',
  '#1504': 'Feedhold 与 Override 控制\nbit2=1 Feedhold（暂停进给）、bit4=1 Override（进给倍率抑制）。\n版本门控：Pr3221 联动；无单一 Pr 强制条件。\n注意：不要对 bit mask 整数值做范围诊断，插件只提示语义。',
  '#1510': 'FileOperationControlWord（档桉控制字）\nbit0=1 Reload 主程序、bit1=1 Reload 副程序、bit2=1 仅更新主程序档名/行号/序号。\n与 #1517 联动；写入需同步 #1517，应 WAIT() 至少一单节后读回。',
  '#1820': '静音插补模式（Silent Interpolation Mode）\n值 0 关闭、值 1 仅 G01 静音插补、值 2 全模式静音插补。\n版本门控：10.120.24E / 10.118.28A / 10.118.31+ 及后续版本可用；旧版本写入值 1/2 会被忽略且不报警。',

  // §2.7.1 末尾 G92 / G92.1 系统变数补遗
  '#1901': 'G92 / G92.1 座标系偏移量（各轴向，轴群 1）\nr/w，对应 1~4 轴群；#1901~#1918 各轴 G92/G92.1 座标偏移。\n属《轴群使用者记忆变数》子段，不应被普通区域运算逻辑覆写。',
  '#1918': 'G92 / G92.1 座标系偏移量（各轴向，最高轴群）\nr/w，对应 1~4 轴群；详见 #1901。',
  '#1930': 'G92.1 座标系旋转角度\nr/w，对应 1~4 轴群；跟 #1931~#1933 旋转中心一起决定 G92.1 的旋转座标变换。',
  '#1931': 'G92.1 座标系旋转中心轴 1\nr/w，对应 1~4 轴群；标记 G92.1 动作中止旋转中心所在轴。',
  '#1932': 'G92.1 座标系旋转中心轴 2\nr/w，对应 1~4 轴群；详见 #1931。',
  '#1933': 'G92.1 座标系旋转中心轴 3\nr/w，对应 1~4 轴群；详见 #1931。',

  // §2.10 PLC↔系统变数映射（C101~C132 ↔ #6001~#6032 区段，建议只读）
  '#6001': 'PLC C101 对应状态（PLC → CNC）\n区段 #6001~#6032 对应 C101~C132；Macro 可经 #6xxx 读到 PLC 请求状态。\n建议只读：写入覆盖会被 PLC 下一周期覆盖。',
  '#6032': 'PLC C132 对应状态（PLC → CNC）\n区段 #6001~#6032 对应 C101~C132；详见 #6001。'
};

/**
 * 由变量记号（如 "#1500" / "#1930"）查询系统变数语义。
 * @param {string} variable 变量记号，大写，形如 "#1500"
 * @returns {string|null} 语义说明 multiline 字符串，无则 null
 */
function getSystemVariableDoc(variable) {
  if (!variable) return null;
  const normalized = variable.toUpperCase();
  return SYSTEM_VARIABLE_DOCS[normalized] || null;
}

module.exports = {
  SYSTEM_VARIABLE_DOCS,
  getSystemVariableDoc
};
