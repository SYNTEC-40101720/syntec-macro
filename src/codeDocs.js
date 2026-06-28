// Hover documentation for G/M codes.

const gCodeDocs = {
  'G00': { sig: 'G00 X_ Y_ Z_;', doc: '快速定位，以快速进给移动到指定位置。' },
  'G01': { sig: 'G01 X_ Y_ Z_ F_;', doc: '直线插补，以指定进给速度沿直线切削。' },
  'G02': { sig: 'G02 X_ Y_ I_ J_ R_ F_;', doc: '顺时针圆弧插补。' },
  'G03': { sig: 'G03 X_ Y_ I_ J_ R_ F_;', doc: '逆时针圆弧插补。' },
  'G04': { sig: 'G04 P_;', doc: '暂停/延时执行。' },
  'G10': { sig: 'G10 L_ ...;', doc: '可程序资料输入，用于写入补正、坐标系或 I/O 相关资料。' },
  'G17': { sig: 'G17;', doc: '选择 XY 平面。' },
  'G18': { sig: 'G18;', doc: '选择 ZX 平面。' },
  'G19': { sig: 'G19;', doc: '选择 YZ 平面。' },
  'G20': { sig: 'G20;', doc: '英制单位输入。' },
  'G21': { sig: 'G21;', doc: '公制单位输入。' },
  'G28': { sig: 'G28 ...;', doc: '经中间点返回机械原点。' },
  'G40': { sig: 'G40;', doc: '取消刀具半径补偿。' },
  'G41': { sig: 'G41 D_;', doc: '刀具半径左补偿。' },
  'G42': { sig: 'G42 D_;', doc: '刀具半径右补偿。' },
  'G43': { sig: 'G43 H_;', doc: '启用正向刀长补偿。' },
  'G49': { sig: 'G49;', doc: '取消刀长补偿。' },
  'G53': { sig: 'G53 ...;', doc: '机械坐标系定位。' },
  'G54': { sig: 'G54;', doc: '选择第 1 工件坐标系。' },
  'G55': { sig: 'G55;', doc: '选择第 2 工件坐标系。' },
  'G56': { sig: 'G56;', doc: '选择第 3 工件坐标系。' },
  'G57': { sig: 'G57;', doc: '选择第 4 工件坐标系。' },
  'G58': { sig: 'G58;', doc: '选择第 5 工件坐标系。' },
  'G59': { sig: 'G59;', doc: '选择第 6 工件坐标系。' },
  'G65': { sig: 'G65 P_ L_ ...;', doc: '非模态宏程序呼叫，P 指定宏程序编号，参数映射到 #1~#26。' },
  'G66': { sig: 'G66 P_ L_ ...;', doc: '模态宏程序呼叫，直到 G67 取消。' },
  'G66.1': { sig: 'G66.1 P_ L_ ...;', doc: '每单节模态宏程序呼叫，直到 G67 取消。' },
  'G67': { sig: 'G67;', doc: '取消 G66/G66.1 模态宏程序呼叫。' },
  'G68': { sig: 'G68 ...;', doc: '坐标旋转/坐标转换相关指令。' },
  'G69': { sig: 'G69;', doc: '取消坐标旋转/坐标转换。' },
  'G80': { sig: 'G80;', doc: '取消固定循环。' },
  'G90': { sig: 'G90;', doc: '绝对坐标编程。' },
  'G91': { sig: 'G91;', doc: '增量坐标编程。' },
  'G94': { sig: 'G94;', doc: '每分钟进给。' },
  'G95': { sig: 'G95;', doc: '每转进给。' },
  'G98': { sig: 'G98;', doc: '固定循环返回初始点。' },
  'G99': { sig: 'G99;', doc: '固定循环返回 R 点。' },
  'G04.101': { sig: 'G04.101 ...;', doc: '机器人 LTP 等待/同步相关替代 G 码。' },
  'G04.102': { sig: 'G04.102 ...;', doc: '机器人 LTP 等待计时相关替代 G 码。' },
  'G04.103': { sig: 'G04.103 ...;', doc: '机器人 LTP 等待/同步相关替代 G 码。' },
  'G43.16': { sig: 'G43.16 P_ X_ Y_ Z_ A_ B_ C_;', doc: '设定工具坐标系，P 指定工具编号。' },
  'G68.18': { sig: 'G68.18 P_ X_ Y_ Z_ A_ B_ C_;', doc: '设定用户坐标系，P 指定坐标系编号。' },
  'G192.1': { sig: 'G192.1 P_ Q_ R_;', doc: '启用机器人末端跟踪。' },
  'G192.2': { sig: 'G192.2;', doc: '关闭机器人末端跟踪。' }
};

const mCodeDocs = {
  'M00': { sig: 'M00;', doc: '程序停止。' },
  'M01': { sig: 'M01;', doc: '选择性程序停止。' },
  'M02': { sig: 'M02;', doc: '程序结束。' },
  'M03': { sig: 'M03 S_;', doc: '主轴正转。' },
  'M04': { sig: 'M04 S_;', doc: '主轴反转。' },
  'M05': { sig: 'M05;', doc: '主轴停止。' },
  'M06': { sig: 'M06 T_;', doc: '换刀。' },
  'M07': { sig: 'M07;', doc: '开启雾状冷却。' },
  'M08': { sig: 'M08;', doc: '开启冷却液。' },
  'M09': { sig: 'M09;', doc: '关闭冷却液。' },
  'M30': { sig: 'M30;', doc: '程序结束并复位。' },
  'M65': { sig: 'M65 P_ ...;', doc: '宏程序调用。' },
  'M96': { sig: 'M96 P_;', doc: '启用中断程序。' },
  'M97': { sig: 'M97;', doc: '取消中断程序。' },
  'M98': { sig: 'M98 P_ H_ L_;', doc: '呼叫 O 副程序，P 指定副程序编号。' },
  'M99': { sig: 'M99;', doc: '子程序返回 / 宏程序结束。' },
  'M198': { sig: 'M198 P_ H_ L_;', doc: '呼叫 O 副程序（另一路径），P 指定副程序编号。' }
};

function getCodeDoc(code) {
  const normalized = code.toUpperCase();
  return gCodeDocs[normalized] || mCodeDocs[normalized] || null;
}

function getCodeShortDescription(code) {
  const doc = getCodeDoc(code);
  return doc ? doc.doc : null;
}

module.exports = {
  gCodeDocs,
  mCodeDocs,
  getCodeDoc,
  getCodeShortDescription
};
