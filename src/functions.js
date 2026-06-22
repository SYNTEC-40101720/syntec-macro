// syntec-macro v2.6.0 - functions.js
// 内置函数完整定义：补全数据 + Hover文档

exports.functions = [

  // ===== 数学函数 =====
  { name: 'ABS',   sig: 'ABS(num)',           doc: '取绝对值\nABS(num) -> 数值\n范例: #3 := ABS(#2 - #1)' },
  { name: 'ACOS',  sig: 'ACOS(num)',           doc: '取反余弦值（弧度）\nACOS(num) -> 数值' },
  { name: 'ASIN',  sig: 'ASIN(num)',           doc: '取反正弦值（弧度）\nASIN(num) -> 数值' },
  { name: 'ATAN',  sig: 'ATAN(num)',           doc: '取反正切值（弧度）\nATAN(num) -> 数值' },
  { name: 'ATAN2', sig: 'ATAN2(y, x)',         doc: '取反正切值（弧度，含象限判断）\nATAN2(y, x) -> 数值' },
  { name: 'COS',   sig: 'COS(angle)',          doc: '取余弦值（弧度）\nCOS(angle) -> 数值' },
  { name: 'SIN',   sig: 'SIN(angle)',          doc: '取正弦值（弧度）\nSIN(angle) -> 数值' },
  { name: 'TAN',   sig: 'TAN(angle)',          doc: '取正切值（弧度）\nTAN(angle) -> 数值' },
  { name: 'SQRT',  sig: 'SQRT(num)',           doc: '取平方根\nSQRT(num) -> 数值' },
  { name: 'CEIL',  sig: 'CEIL(num)',           doc: '向上取整\nCEIL(3.2) -> 4' },
  { name: 'FLOOR', sig: 'FLOOR(num)',          doc: '向下取整\nFLOOR(3.8) -> 3' },
  { name: 'ROUND', sig: 'ROUND(num)',          doc: '四舍五入取整\nROUND(3.5) -> 4' },
  { name: 'EXP',   sig: 'EXP(num)',            doc: '取 e 的 n 次方\nEXP(1) -> 2.718' },
  { name: 'LN',    sig: 'LN(num)',             doc: '取自然对数\nLN(2.718) -> 1' },
  { name: 'LOG',   sig: 'LOG(num)',            doc: '取常用对数（以 10 为底）\nLOG(100) -> 2' },
  { name: 'POW',   sig: 'POW(base, exp)',      doc: '取幂运算\nPOW(2, 3) -> 8' },
  { name: 'MAX',   sig: 'MAX(a, b)',            doc: '取较大值\nMAX(3, 5) -> 5' },
  { name: 'MIN',   sig: 'MIN(a, b)',            doc: '取较小值\nMIN(3, 5) -> 3' },
  { name: 'SIGN',  sig: 'SIGN(num)',            doc: '取符号（-1/0/1）\nSIGN(-5) -> -1' },
  { name: 'RANDOM', sig: 'RANDOM()',           doc: '取 0~1 之间的随机数\nRANDOM() -> 0.732...' },

  // ===== 字符串函数 =====
  { name: 'STR2INT', sig: 'STR2INT(string)',   doc: '将字符串转换为整数\nSTR2INT("123") -> 123\n常配合 SCANTEXT 使用' },
  { name: 'SCANTEXT', sig: 'SCANTEXT(addr)',  doc: '从记忆体位址读取字符串\nSCANTEXT(60001) -> 字符串内容\n参数: NC 记忆体位址（整数）\n返回值: 字符串' },
  { name: 'CHR',    sig: 'CHR(code)',          doc: '将 ASCII 码转换为字元\nCHR(65) -> "A"' },
  { name: 'LEN',    sig: 'LEN(string)',        doc: '取字符串长度\nLEN("ABC") -> 3' },
  { name: 'MID',   sig: 'MID(str, start, len)', doc: '取子字符串\nMID("ABCDEF", 2, 3) -> "BCD"' },
  { name: 'STR',   sig: 'STR(num)',            doc: '将数值转换为字符串\nSTR(123) -> "123"' },
  { name: 'FORMAT', sig: 'FORMAT(fmt, val)',   doc: '将数值格式化为字符串\nFORMAT("%.2f", #1)' },

  // ===== 参数/变量读写 =====
  { name: 'GETARG',    sig: 'GETARG(Xn)',     doc: '读取宏程序呼叫引数\nGETARG(X1) -> 引数 #1 的值\n参数: X1~X15 对应 A~O\nG65 P__ X1#1 -> #1 = GETARG(X1)' },
  { name: 'GETTRAPARG', sig: 'GETTRAPARG(n)', doc: '读取中断触发时储存的参数\nGETTRAPARG(n)' },
  { name: 'PARAM',     sig: 'PARAM(type, idx)', doc: '读取 NC 系统参数\nPARAM(type, idx) -> 数值\ntype: 0=轴, 1=系统, 2=节距补偿\n范例: #1 := PARAM(1, 1001)' },
  { name: 'SYSVAR',    sig: 'SYSVAR("name")', doc: '读取系统变量\nSYSVAR("SYSTEM::NC_MODE") -> 值\n范例: #1 := SYSVAR("SYSTEM::FEEDRATE")' },
  { name: 'SYSDATA',   sig: 'SYSDATA(axis)',  doc: '读取当前轴位置数据\nSYSDATA(axis) -> 数值\naxis: X=0, Y=1, Z=2, A=3, B=4, C=5' },
  { name: 'DRVDATA',   sig: 'DRVDATA(axis)',  doc: '读取驱动器数据\nDRVDATA(axis) -> 数值' },
  { name: 'GETPR',     sig: 'GETPR(prNumber)',  doc: '读取控制器参数\nGETPR(3500) -> 读取 Pr3500 的值\n范例: @1 := GETPR(3500)' },
  { name: 'SETPR',     sig: 'SETPR(prNumber, value)', doc: '写入控制器参数\nSETPR(3500, @1) -> 将 @1 写入 Pr3500\n范例: SETPR(3500, 100)' },

  // ===== 文件 I/O =====
  { name: 'OPEN',   sig: 'OPEN(fileNo, path, mode)', doc: '开启文件\nOPEN(1, "C:\\TEMP\\LOG.TXT", "W")\nmode: R=读取, W=写入, A=附加\n返回值: 0=成功, <0=失败' },
  { name: 'CLOSE',  sig: 'CLOSE(fileNo)',    doc: '关闭文件\nCLOSE(1)' },
  { name: 'PRINT',  sig: 'PRINT(fileNo, "text")', doc: '写入文本到文件\nPRINT(1, "Hello")\nPRINT(1, STR(#1)) 写入变量值' },
  { name: 'READ',   sig: 'READ(fileNo, var)', doc: '从文件读取一行到变量\nREAD(1, #var)' },
  { name: 'EXIST',  sig: 'EXIST("path")',    doc: '检查文件是否存在\nEXIST("C:\\TEMP\\DATA.TXT") -> 1=存在, 0=不存在' },
  { name: 'DELETE', sig: 'DELETE("path")',   doc: '删除文件\nDELETE("C:\\TEMP\\OLD.TXT")' },
  { name: 'RENAME', sig: 'RENAME(old, new)',  doc: '重命名文件\nRENAME("A.TXT", "B.TXT")' },

  // ===== 数字量 I/O =====
  { name: 'READDI',  sig: 'READDI(port)',   doc: '读取数字输入 DI\nREADDI(1) -> 0 或 1\n参数: DI 埠号（整数）' },
  { name: 'READDO',  sig: 'READDO(port)',   doc: '读取数字输出 DO\nREADDO(1) -> 0 或 1' },
  { name: 'SETDO',   sig: 'SETDO(port, val)', doc: '设定数字输出\nSETDO(1, 1) -> DO1=1\nSETDO(1, 0) -> DO1=0' },
  { name: 'READABIT', sig: 'READABIT(port, bit)', doc: '读取指定埠的特定位元\nREADABIT(1, 3) -> 读取 PORT1 的 bit 3' },
  { name: 'SETABIT',  sig: 'SETABIT(port, bit, val)', doc: '设定指定埠的特定位元\nSETABIT(1, 3, 1)' },
  { name: 'READRREGBIT', sig: 'READRREGBIT(reg)', doc: '读取暂存器位元\nREADRREGBIT(reg)' },
  { name: 'SETRREGBIT',  sig: 'SETRREGBIT(reg, val)', doc: '设定暂存器位元\nSETRREGBIT(reg, val)' },
  { name: 'READREG',  sig: 'READREG(regNo)', doc: '读取暂存器值\nREADREG(1) -> 暂存器 1 的值' },
  { name: 'SETREG',   sig: 'SETREG(regNo, val)', doc: '设定暂存器值\nSETREG(1, 100)' },

  // ===== 刀具/坐标系 =====
  { name: 'TOOLSET', sig: 'TOOLSET(toolNo)', doc: '设定当前刀具编号\nTOOLSET(5) -> 切换到刀具 5' },
  { name: 'STD',    sig: 'STD(ax)',          doc: '设定工件坐标轴\nSTD(X) -> 设定 X 轴' },
  { name: 'STDAX',  sig: 'STDAX(X, Y, Z)',   doc: '同时设定多个坐标轴\nSTDAX(X, Y, Z)' },
  { name: 'SETCO',  sig: 'SETCO(coord)',     doc: '设定当前坐标系\nSETCO(1) -> G54\nSETCO(6) -> G59' },

  // ===== 数据库 =====
  { name: 'DBOPEN',   sig: 'DBOPEN("filename")',  doc: '开启数据库文件\nDBOPEN("TOOL.DB")\n返回值: 0=成功' },
  { name: 'DBCLOSE',  sig: 'DBCLOSE',        doc: '关闭当前数据库\nDBCLOSE' },
  { name: 'DBNEW',    sig: 'DBNEW("schema")', doc: '创建新数据库\nDBNEW("ID:I,NAME:S,LENGTH:D")' },
  { name: 'DBLOAD',   sig: 'DBLOAD(group)',  doc: '从数据库加载一笔记录\nDBLOAD(群组号)' },
  { name: 'DBSAVE',   sig: 'DBSAVE("filename")', doc: '将数据库储存到文件\nDBSAVE("TOOL.DB")' },
  { name: 'DBINSERT', sig: 'DBINSERT(group)', doc: '向数据库插入一笔记录\nDBINSERT(群组号)' },
  { name: 'DBDELETE', sig: 'DBDELETE(group)', doc: '删除当前记录\nDBDELETE(群组号)' },
  { name: 'DBEDIT',   sig: 'DBEDIT(field, val)', doc: '编辑当前记录栏位\nDBEDIT(2, "ToolName")' },

  // ===== 仿真/绘图 =====
  { name: 'SETDRAW',  sig: 'SETDRAW(mode, color)', doc: '设定刀具路径绘图模式\nSETDRAW(0, 1) -> mode: 0=关闭, 1=实线, 2=虚线\ncolor: 颜色代码' },
  { name: 'DRAWHOLE', sig: 'DRAWHOLE(x, y, r)', doc: '绘制钻孔路径\nDRAWHOLE(X, Y, R)' },

  // ===== 系统/诊断 =====
  { name: 'ALARM',   sig: 'ALARM(no, "msg")', doc: '触发警报并暂停程序\nALARM(1001, "Tool not ready")\nno: 警报编号\nmsg: 显示讯息' },
  { name: 'MSG',     sig: 'MSG("text")',     doc: '在萤幕显示讯息（非阻断）\nMSG("Progress: " + STR(#1) + "%")' },
  { name: 'WAIT',    sig: 'WAIT(ms)',         doc: '等待（毫秒）\nWAIT(2000) -> 等待 2 秒' },
  { name: 'SLEEP',   sig: 'SLEEP(ms)',        doc: '等待（毫秒）\nSLEEP(100) -> 等待 100ms\n建议在无穷循环中定期调用以避免卡死' },
  { name: 'CHKMI',   sig: 'CHKMI',           doc: '检查 M 码是否生效\nCHKMI -> 0=未生效, 1=已生效' },
  { name: 'CHKMN',   sig: 'CHKMN(Mnn)',       doc: '检查指定 M 码是否存在\nCHKMN(98) -> 1=存在' },
  { name: 'CHKSN',   sig: 'CHKSN(Snn)',       doc: '检查 S 码\nCHKSN(1000)' },
  { name: 'CHKMT',   sig: 'CHKMT(Tnn)',       doc: '检查 T 码\nCHKMT(5)' },
  { name: 'CHKINF',  sig: 'CHKINF(axis)',     doc: '检查轴资讯\nCHKINF(X)' },
  { name: 'AXID',    sig: 'AXID("name")',     doc: '取得轴 ID 编号\nAXID("X") -> 0' },

  // ===== 堆栈 =====
  { name: 'PUSH',   sig: 'PUSH(value)',      doc: '将值推入堆叠\nPUSH(#1)' },
  { name: 'POP',    sig: 'POP()',            doc: '从堆叠顶部取出值\n#1 := POP()' },
  { name: 'STKTOP', sig: 'STKTOP()',         doc: '读取堆叠顶部值（不取出）\n#1 := STKTOP()' },

  // ===== 刀具路径 =====
  { name: 'ARC',   sig: 'ARC(X, Y, I, J)',   doc: '绘制圆弧路径（仿真）\nARC(X, Y, I, J)\nI, J 为相对中心坐标' },
  { name: 'LINE',  sig: 'LINE(X, Y)',        doc: '绘制直线路径（仿真）\nLINE(X, Y)' },

  // ===== 其他 =====
  { name: 'BITAND',  sig: 'BITAND(a, b)',   doc: '位元 AND 运算\nBITAND(5, 3) -> 1' },
  { name: 'BITOR',   sig: 'BITOR(a, b)',    doc: '位元 OR 运算\nBITOR(5, 3) -> 7' },
  { name: 'BITXOR',  sig: 'BITXOR(a, b)',   doc: '位元 XOR 运算\nBITXOR(5, 3) -> 6' },
  { name: 'BITNOT',  sig: 'BITNOT(a)',      doc: '位元 NOT 运算\nBITNOT(5)' },
  { name: 'INLIST',  sig: 'INLIST(val, a, b, c...)', doc: '检查值是否在列表中\nINLIST(#1, 1, 2, 3, 4, 5)' },
  { name: 'PI',      sig: 'PI()',           doc: '取圆周率\nPI() -> 3.14159...' },
  { name: 'DEG',     sig: 'DEG(rad)',        doc: '弧度转角度\nDEG(3.14159) -> 180' },
  { name: 'RAD',     sig: 'RAD(deg)',        doc: '角度转弧度\nRAD(180) -> 3.14159' },
  { name: 'MOD',     sig: 'MOD(a, b)',       doc: '取余数运算\nMOD(10, 3) -> 1' }
];

/** 构建函数名索引 Map，key 为函数名（大写），value 为函数对象 */
exports.buildFunctionIndex = function() {
  const map = new Map();
  for (const fn of exports.functions) {
    map.set(fn.name, fn);
  }
  return map;
};
