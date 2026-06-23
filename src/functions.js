// syntec-macro v2.6.1 - functions.js
// 内置函数完整定义：补全数据 + Hover文档
// 基于《新代控制器技术参考手册》函数表修订

exports.functions = [

  // ===== 数学函数（角度制） =====
  { name: 'ABS',   sig: 'ABS(num)',           doc: '取绝对值\nABS(num) -> 数值\n范例: #1 := ABS(#10);\n#1 = 1.1' },
  { name: 'ACOS',  sig: 'ACOS(num)',           doc: '取反余弦值（角度制）\nACOS(num) -> 角度\n范例: ACOS(1) -> 0, ACOS(-1) -> 180' },
  { name: 'ASIN',  sig: 'ASIN(num)',           doc: '取反正弦值（角度制）\nASIN(num) -> 角度\n范例: ASIN(1) -> 90, ASIN(-1) -> -90' },
  { name: 'ATAN',  sig: 'ATAN(num)',           doc: '取反正切值（角度制，±90°）\nATAN(num) -> 角度\n范例: ATAN(1) -> 45, ATAN(-1) -> -45' },
  { name: 'ATAN2', sig: 'ATAN2(y, x)',         doc: '取 Y/X 反正切值（角度制，含象限判断，±180°）\nATAN2(y, x) -> 角度\n有效版本：10.118.29W+\n范例: ATAN2(1,1) -> 135' },
  { name: 'COS',   sig: 'COS(angle)',          doc: '取余弦值（角度制）\nCOS(angle) -> 数值\n范例: COS(180) -> -1' },
  { name: 'SIN',   sig: 'SIN(angle)',          doc: '取正弦值（角度制）\nSIN(angle) -> 数值\n范例: SIN(90) -> 1' },
  { name: 'TAN',   sig: 'TAN(angle)',          doc: '取正切值（角度制）\nTAN(angle) -> 数值\n范例: TAN(45) -> 1' },
  { name: 'SQRT',  sig: 'SQRT(num)',           doc: '取平方根\nSQRT(num) -> 数值\n范例: SQRT(4) -> 2' },
  { name: 'CEIL',  sig: 'CEIL(num)',           doc: '向上取整（返回>=该值的最小整数）\nCEIL(1.4) -> 2' },
  { name: 'FLOOR', sig: 'FLOOR(num)',          doc: '向下取整（返回<=该值的最大整数）\nFLOOR(1.4) -> 1' },
  { name: 'ROUND', sig: 'ROUND(num)',          doc: '四舍五入取整\nROUND(1.4) -> 1, ROUND(1.5) -> 2' },
  { name: 'EXP',   sig: 'EXP(num)',            doc: '计算以自然数 e 为底的指数值\nEXP(num) -> 数值\n有效版本：10.116.16\n范例: EXP(1) -> 2.71828' },
  { name: 'LN',    sig: 'LN(num)',             doc: '计算以自然数 e 为底的对数值（自然对数）\nLN(num) -> 数值\n有效版本：10.116.16\n范例: LN(100) -> 4.60517\n注意：引数需为正数' },
  { name: 'POW',   sig: 'POW(base, exp)',      doc: '取幂运算\nPOW(base, exp) -> 数值\n有效版本：10.116.16\n范例: POW(16, 0.5) -> 4\n注意：基底不可为负值' },
  { name: 'MAX',   sig: 'MAX(a, b)',            doc: '取两输入值的最大值\nMAX(a, b) -> 数值\n范例: MAX(1.2, 4.5) -> 4.5' },
  { name: 'MIN',   sig: 'MIN(a, b)',            doc: '取两输入值的最小值\nMIN(a, b) -> 数值\n范例: MIN(1.2, 4.5) -> 1.2' },
  { name: 'SIGN',  sig: 'SIGN(num)',            doc: '取符号值（负数=-1, 正数=1, 0=0）\nSIGN(num) -> -1/0/1\n范例: SIGN(-4) -> -1' },
  { name: 'RANDOM', sig: 'RANDOM()',           doc: '产生 0~32767 间的一个随机数\nRANDOM() -> 随机整数\n范例: #1 := RANDOM();' },

  // ===== 字符串函数 =====
  { name: 'STR2INT', sig: 'STR2INT(string)',   doc: '将数字字符串转换为整数\nSTR2INT(string) -> 整数\n范例: STR2INT("123") -> 123\n常配合 SCANTEXT 使用\n注意：含文字则不合法' },
  { name: 'SCANTEXT', sig: 'SCANTEXT(addr)',  doc: '从公用变数读取字符串内容\nSCANTEXT(addr) -> 字符串\n参数: 变数号码（整数）\n范例: #1 := SCANTEXT(1);' },

  // ===== 变数/资料存取函数 =====
  { name: 'GETARG',    sig: 'GETARG(name)',     doc: '读取呼叫者传递的引数\nGETARG(name) -> 值\n参数: 引数字母名称（如 X, Z1 等）\n范例: #1 := GETARG(X);\n若引数不存在则回传 VACANT (#0)' },
  { name: 'GETTRAPARG', sig: 'GETTRAPARG(name)', doc: '读取 G66/G66.1 Trap 单节内的引数内容\nGETTRAPARG(name) -> 值\n参数: 引数字母名称\n范例: #1 := GETTRAPARG(X);' },
  { name: 'PARAM',     sig: 'PARAM(prNo[, axisGroup])', doc: '读取系统参数 Pr 或 V12 PN 参数\nPARAM(prNo) -> 整数\nPARAM(prNo, axisGroup) -> 整数/浮点/字符串\n范例: #1 := PARAM(3204);\n#2 := PARAM(20001, 2);\n若参数不支援则回传 VACANT' },
  { name: 'SYSVAR',    sig: 'SYSVAR(group, code)', doc: '读取特定轴群中的系统变数\nSYSVAR(group, code) -> 数值\n参数: group=轴群识别码(1~N), code=系统变数码\n范例: #1 := SYSVAR(1, 1000);' },
  { name: 'SYSDATA',   sig: 'SYSDATA(diagNo)',  doc: '读取系统诊断变数\nSYSDATA(diagNo) -> 数值\n有效版本：10.118.23U+\n范例: #1 := SYSDATA(336);\n注意：执行前建议下 WAIT() 挡预解' },
  { name: 'DRVDATA',   sig: 'DRVDATA(stationNo, varNo)', doc: '读取驱动器状态变数\nDRVDATA(stationNo, varNo) -> 数值\n有效版本：10.118.23U+\nvarNo: 10进位数 或 "16进制字串"(如"D61h")\n范例: #1 := DRVDATA(1000, 3366);\n注意：每个函数执行约0.1~0.2s' },

  // ===== 标准单位转换 =====
  { name: 'STD',    sig: 'STD(val, unit)',      doc: '根据 Pr17 将整数数值转换成系统设定的输入单位\nSTD(val, unit) -> 数值\n参数: val=欲转换数值, unit=标准单位(常用 #1600)\n范例: #10 := STD(#9, #1600);' },
  { name: 'STDAX',  sig: 'STDAX(var, axis)',   doc: '将整数数值转为对应轴向的标准单位\nSTDAX(var, axis) -> 数值\n参数: var=变数, axis=轴向名称\n范例: #3 := STDAX(#3, A);\n输入为小数点型态则不转换' },

  // ===== 文件 I/O =====
  { name: 'OPEN',   sig: 'OPEN("path"[, "mode"])', doc: '在 NcFiles 或 Macro 资料夹开启文字档\nOPEN("path") -> 开启档案\nOPEN("path", "mode") -> mode: "a"=附加, 不指定=覆写\n范例: OPEN("PROBE.NC");\nOPEN("COM"); 表示打开 RS232/RS485 传输埠' },
  { name: 'CLOSE',  sig: 'CLOSE()',    doc: '关闭由 OPEN 开启的档案\nCLOSE()\n程序结束后档案亦会自动关闭' },
  { name: 'PRINT',  sig: 'PRINT("text")', doc: '输出字符串到档案或传输埠\nPRINT("text")\n字符串中的变数名称会被替换为变数内容\n范例: PRINT("G01 X#3 Y@53 Z20.0");' },

  // ===== I/O 控制函数 =====
  { name: 'READDI',  sig: 'READDI(portNo)',   doc: '读取指定的 DI 点编号\nREADDI(portNo) -> 0/1\n有效版本：10.116.23\n参数: portNo=点编号(0~511)\n范例: #88 := READDI(11);' },
  { name: 'READDO',  sig: 'READDO(portNo)',   doc: '读取指定的 DO 点编号\nREADDO(portNo) -> 0/1\n有效版本：10.116.23\n范例: #88 := READDO(11);' },
  { name: 'SETDO',   sig: 'SETDO(portNo, val)', doc: '设定指定的 DO 点开/关\nSETDO(portNo, val)\n有效版本：10.116.23\nval: 1=开, 0=关\n范例: SETDO(3, 1);\n注意：DO 点编号范围 0~511' },
  { name: 'READABIT', sig: 'READABIT(portNo)', doc: '读取指定的 A 点编号\nREADABIT(portNo) -> 0/1\n有效版本：10.116.44\n范例: #88 := READABIT(11);\n注意：A 点编号范围 0~511' },
  { name: 'SETABIT',  sig: 'SETABIT(portNo, val)', doc: '设定指定的 A 点开/关\nSETABIT(portNo, val)\n有效版本：10.116.44\nval: 1=开, 0=关\n注意：A 点编号范围 0~511' },
  { name: 'READRREGBIT', sig: 'READRREGBIT(regNo, bit)', doc: '读取指定的 R 值编号及指定的 Bit\nREADRREGBIT(regNo, bit) -> 0/1\n有效版本：10.116.39\n参数: regNo=R值编号(0~65535), bit=指定Bit(0~31)\n范例: @52 := READRREGBIT(31, 3);' },
  { name: 'SETRREGBIT',  sig: 'SETRREGBIT(regNo, bit, val)', doc: '设定指定的 R 值编号、指定 Bit 的开/关\nSETRREGBIT(regNo, bit, val)\n有效版本：10.116.39\nval: 1=开, 0=关\n范例: SETRREGBIT(50, 3, 1);' },

  // ===== XML/Cycle 档案操作函数 =====
  { name: 'DBOPEN',   sig: 'DBOPEN("filename")',  doc: '开启既有的 Cycle 档案\nDBOPEN("filename") -> 资料个数(成功) / 0(失败)\n范例: DBOPEN("Test.cyc");\n同时间仅能开启一个 Cycle 档案' },
  { name: 'DBNEW',    sig: 'DBNEW("filename")', doc: '新增并开启全新的 Cycle 档案\nDBNEW("filename") -> 1(成功) / 0/-1/-2(失败)\n有效版本：10.118.56L+\n失败原因: -1=档名过长, -2=已存在' },
  { name: 'DBLOAD',   sig: 'DBLOAD(index)',  doc: '读取第 index 笔的 Cycle 资料\nDBLOAD(index) -> 1(成功) / 0(失败)\n范例: DBLOAD(0); 读取第0笔' },
  { name: 'DBSAVE',   sig: 'DBSAVE(index)', doc: '覆盖第 index 笔的 Cycle 资料\nDBSAVE(index) -> 1(成功) / 0(失败)\n有效版本：10.118.39+\n范例: DBSAVE(0);' },
  { name: 'DBINSERT', sig: 'DBINSERT(index, "name")', doc: '新增 Cycle 资料到第 index 笔\nDBINSERT(index, "CycleName") -> 1(成功) / 0/-1/-2/-3(失败)\n有效版本：10.118.56L+\n范例: DBINSERT(0, "WarmTest");' },
  { name: 'DBDELETE', sig: 'DBDELETE(index)', doc: '删除第 index 笔的 Cycle 资料\nDBDELETE(index) -> 1(成功) / 0/-1/-2(失败)\n有效版本：10.118.56L+\n范例: DBDELETE(0);' },

  // ===== 图形模拟函数 =====
  { name: 'SETDRAW',  sig: 'SETDRAW(color[, fill, radius])', doc: '定义图形模拟的画图样式\nSETDRAW(color) -> 原颜色值(可暂存恢复)\nSETDRAW(color, fill, radius)\n参数: color=路径颜色(BGR码), fill=填充颜色, radius=刀具半径\n范例: SETDRAW(255, 65280, 5);' },
  { name: 'DRAWHOLE', sig: 'DRAWHOLE()', doc: '在目前位置画一个圆（图形模拟内有效）\nDRAWHOLE()\n需配合 SETDRAW 定义的颜色和刀具半径' },

  // ===== 系统信息/检查函数 =====
  { name: 'ALARM',   sig: 'ALARM(id[, "msg"])', doc: '触发宏程序警报\nALARM(id) 或 ALARM(id, "msg")\n参数: id=警报ID(0~65535), msg=警报内容(中文≤19字,英文≤39字)\n会伴随触发警报 COR-027\n范例: ALARM(300); ALARM(301, "ALARM Content");' },
  { name: 'MSG',     sig: 'MSG([id, ]"text")', doc: '显示提示信息（可按 ESC 消除）\nMSG(id) 或 MSG("text") 或 MSG(id, "text")\n参数: id=提示ID(0~65535), text=提示内容\n范例: MSG("钻头遗失"); MSG(100, "钻头遗失");' },
  { name: 'WAIT',    sig: 'WAIT()',         doc: '系统停止预解，直到 WAIT 前指令执行完毕\nWAIT()\n确保 WAIT 前的 G/M 码执行完毕前不会继续预解\n常用于读取系统数据前挡预解' },
  { name: 'SLEEP',   sig: 'SLEEP()',        doc: '暂时放弃此次宏程序循环的执行权\nSLEEP()\n配合循环使用，避免进入无穷循环而造成人机卡死\n建议在 REPEAT/WHILE/FOR/GOTO 循环中适时调用' },
  { name: 'CHKMN',   sig: 'CHKMN("code")',  doc: '检查机械厂代码是否一致\nCHKMN("code") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #51 := CHKMN("5566");' },
  { name: 'CHKSN',   sig: 'CHKSN("sn")',    doc: '检查控制器序号是否一致\nCHKSN("sn") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #52 := CHKSN("M9A0001");' },
  { name: 'CHKMT',   sig: 'CHKMT("type")',  doc: '检查机床属性是否一致\nCHKMT("type") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #53 := CHKMT("MILL");' },
  { name: 'CHKMI',   sig: 'CHKMI("model")', doc: '检查控制器机型是否一致\nCHKMI("model") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #54 := CHKMI("S");' },
  { name: 'CHKINF',  sig: 'CHKINF(cat, "code")', doc: '检查代码与类别编号对应的内容是否一致\nCHKINF(cat, "code") -> 1(一致) / 0(不符)\n目标版本：10.118.22M+\ncat: 1=机械厂代码, 2=序号, 3=机床属性, 4=机型, 5=专机代码\n范例: #51 := CHKINF(1, "5566");' },
  { name: 'AXID',    sig: 'AXID("name")',     doc: '查询轴名称对应的轴编号（1基）\nAXID("name") -> 轴编号(整数) / VACANT(不存在)\n范例: AXID(Y) -> 2, AXID(Y2) -> 6' },

  // ===== 堆栈操作函数 =====
  { name: 'PUSH',   sig: 'PUSH(value)',      doc: '将资料塞进栈（Stack）\nPUSH(value)\n最先 PUSH 的值在栈最底层，依序往上叠加\n范例: PUSH(#1); PUSH(5);' },
  { name: 'POP',    sig: 'POP()',            doc: '从栈中取出资料（由最上层取到最底层）\nPOP() -> 值\n范例: #1 := POP();' },
  { name: 'STKTOP', sig: 'STKTOP[index]',    doc: '复制栈中的资料（不删除）\nSTKTOP[index] -> 值\n范例: #1 := STKTOP[0];  // 最顶层' }
];

/** 构建函数名索引 Map，key 为函数名（大写），value 为函数对象 */
exports.buildFunctionIndex = function() {
  const map = new Map();
  for (const fn of exports.functions) {
    map.set(fn.name, fn);
  }
  return map;
};