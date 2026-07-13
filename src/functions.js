// functions.js
// 内置函数完整定义：补全数据 + Hover文档
// 基于《新代控制器技术参考手册》函数表修订

exports.functions = [

  // ===== 数学函数（角度制） =====
  { name: 'ABS',   sig: 'ABS(num)',           doc: '取绝对值\nABS(num) -> 数值\n范例: #1 := ABS(#10);\n#1 = 1.1' },
  { name: 'ACOS',  sig: 'ACOS(num)',           doc: '取反余弦值（角度制）\nACOS(num) -> 角度\n范例: ACOS(1) -> 0, ACOS(-1) -> 180\n注意：引数范围为 -1~1；越界会触发 RS-008 值域错误' },
  { name: 'ASIN',  sig: 'ASIN(num)',           doc: '取反正弦值（角度制）\nASIN(num) -> 角度\n范例: ASIN(1) -> 90, ASIN(-1) -> -90\n注意：引数范围为 -1~1；越界会触发 RS-008 值域错误' },
  { name: 'ATAN',  sig: 'ATAN(num)',           doc: '取反正切值（角度制，±90°）\nATAN(num) -> 角度\n范例: ATAN(1) -> 45, ATAN(-1) -> -45' },
  { name: 'ATAN2', sig: 'ATAN2(y, x)',         doc: '取 Y/X 反正切值（角度制，含象限判断，±180°）\nATAN2(y, x) -> 角度\n有效版本：10.118.29W、10.118.40C、10.118.42\n范例: ATAN2(1,-1) -> 135, ATAN2(1,0) -> 90\n注意：y 和 x 不可同时为 0' },
  { name: 'COS',   sig: 'COS(angle)',          doc: '取余弦值（角度制）\nCOS(angle) -> 数值\n范例: COS(180) -> -1' },
  { name: 'SIN',   sig: 'SIN(angle)',          doc: '取正弦值（角度制）\nSIN(angle) -> 数值\n范例: SIN(90) -> 1' },
  { name: 'TAN',   sig: 'TAN(angle)',          doc: '取正切值（角度制）\nTAN(angle) -> 数值\n范例: TAN(45) -> 1' },
  { name: 'SQRT',  sig: 'SQRT(num)',           doc: '取平方根\nSQRT(num) -> 数值\n范例: SQRT(4) -> 2\n注意：引数需大于或等于 0；负数会触发 RS-008 值域错误' },
  { name: 'CEIL',  sig: 'CEIL(num)',           doc: '向上取整（返回>=该值的最小整数）\nCEIL(1.4) -> 2' },
  { name: 'FLOOR', sig: 'FLOOR(num)',          doc: '向下取整（返回<=该值的最大整数）\nFLOOR(1.4) -> 1' },
  { name: 'ROUND', sig: 'ROUND(num)',          doc: '四舍五入取整\nROUND(1.4) -> 1, ROUND(1.5) -> 2' },
  { name: 'EXP',   sig: 'EXP(num)',            doc: '计算以自然数 e 为底的指数值\nEXP(num) -> 数值\n有效版本：10.116.16\n范例: EXP(1) -> 2.71828' },
  { name: 'LN',    sig: 'LN(num)',             doc: '计算以自然数 e 为底的对数值（自然对数）\nLN(num) -> 数值\n有效版本：10.116.16\n范例: LN(100) -> 4.60517\n注意：引数需为正数；否则触发 RS-008 值域错误' },
  { name: 'POW',   sig: 'POW(base, exp)',      doc: '取幂运算\nPOW(base, exp) -> 数值\n有效版本：10.116.16\n范例: POW(16, 0.5) -> 4\n注意：基底不可为负值；否则触发 COR-122' },
  { name: 'MAX',   sig: 'MAX(a, b)',            doc: '取两输入值的最大值\nMAX(a, b) -> 数值\n范例: MAX(1.2, 4.5) -> 4.5' },
  { name: 'MIN',   sig: 'MIN(a, b)',            doc: '取两输入值的最小值\nMIN(a, b) -> 数值\n范例: MIN(1.2, 4.5) -> 1.2' },
  { name: 'SIGN',  sig: 'SIGN(num)',            doc: '取符号值（负数=-1, 正数=1, 0=0）\nSIGN(num) -> -1/0/1\n范例: SIGN(-4) -> -1' },
  { name: 'RANDOM', sig: 'RANDOM()',           doc: '产生 0~32767 间的一个随机数\nRANDOM() -> 随机整数\n范例: #1 := RANDOM();' },

  // ===== 字符串函数 =====
  { name: 'STR2INT', sig: 'STR2INT(string)',   doc: '将数字字符串转换为整数\nSTR2INT(string) -> 整数\n范例: STR2INT("123") -> 123，STR2INT("123.456") -> 123\n常配合 SCANTEXT 使用\n注意：含文字则不合法' },
  { name: 'SCANTEXT', sig: 'SCANTEXT(addr)',  doc: '读取公用变数经 ASCII 转码储存的字符串内容\nSCANTEXT(addr) -> 字符串\n参数: 公用变数号码（整数）\n范例: #1 := SCANTEXT(1);' },

  // ===== 变数/资料存取函数 =====
  { name: 'GETARG',    sig: 'GETARG(name)',     doc: '读取呼叫者传递的标准或扩充引数\nGETARG(name) -> 值\n参数: 引数字母名称（如 X, Z1 等）\n范例: #1 := GETARG(X);\n若引数不存在则回传 VACANT (#0)' },
  { name: 'GETTRAPARG', sig: 'GETTRAPARG(name)', doc: '读取 G66/G66.1 Trap 单节内的引数内容\nGETTRAPARG(name) -> 值\n参数: 引数字母名称\n不同于 GETARG 的呼叫者引数，读取的是当前 Trap 单节引数\n范例: #1 := GETTRAPARG(X);' },
  { name: 'PARAM',     sig: 'PARAM(prNo[, axisGroup])', doc: '读取系统参数 Pr 或 V12 PN 参数\nPARAM(prNo) -> 整数\nPARAM(prNo, axisGroup) -> 整数/浮点/字符串\n范例: #1 := PARAM(3204);\n#2 := PARAM(20001, 2);\n若参数不支援则回传 VACANT' },
  { name: 'SYSVAR',    sig: 'SYSVAR(group, code)', doc: '读取特定轴群中的系统变数\nSYSVAR(group, code) -> 数值\n参数: group=轴群识别码(1~N), code=系统变数码\n范例: #1 := SYSVAR(1, 1000);' },
  { name: 'SYSDATA',   sig: 'SYSDATA(diagNo)',  doc: '读取系统诊断变数\nSYSDATA(diagNo) -> 数值\n有效版本：10.118.23U+\n范例: #1 := SYSDATA(336);\n注意：执行前建议下 WAIT() 挡预解' },
  { name: 'DRVDATA',   sig: 'DRVDATA(stationNo, varNo)', doc: '读取驱动器状态变数\nDRVDATA(stationNo, varNo) -> 数值\n有效版本：10.118.23U+\nstationNo 必须为整数；varNo 为十进制整数或 "xxxh" 十六进制字串（x=0~F，小写 h），例如 "D61h"\n范例: #1 := DRVDATA(1000, 3366);\n注意：每个函数执行约0.1~0.2s；无对应驱动器时回传 VACANT' },
  { name: 'GETPR',   sig: 'GETPR(prNo)',      doc: '读取系统参数 Pr 的值\nGETPR(prNo) -> 数值\n参数: prNo=参数编号\n范例: @1 := GETPR(3500);\n支援版本：10.118.56Z、10.118.60T+' },
  { name: 'SETPR',   sig: 'SETPR(prNo, val)',  doc: '写入系统参数 Pr 的值\nSETPR(prNo, val)\n参数: prNo=参数编号, val=写入值\n范例: SETPR(3500, @1);\n支援版本：10.118.56Z、10.118.60T+' },

  // ===== 标准单位转换 =====
  { name: 'STD',    sig: 'STD(val, unit)',      doc: '根据 Pr17 将整数数值转换成系统设定的输入单位（IU）\nSTD(val, unit) -> 数值\n参数: val=欲转换数值, unit=标准单位（常用 #1600，对应 Pr17 的 LIU）\n范例: #10 := STD(#9, #1600);\n注意：长度或角度的整数引数通常应先标准化，避免依控制精度产生歧义' },
  { name: 'STDAX',  sig: 'STDAX(var, axis)',   doc: '将整数数值转为对应轴向的标准单位\nSTDAX(var, axis) -> 数值\n参数: var=变数, axis=轴向名称\n范例: #3 := STDAX(#3, A);\n注意：输入为小数点型态时不进行数值或型别转换；输入为整数且 Pr3241=1 时仅转换为小数点型态' },

  // ===== 文件 I/O =====
  { name: 'OPEN',   sig: 'OPEN("path"[, "mode"])', doc: '在 NcFiles 或 Macro 资料夹开启文字档\nOPEN("path") -> 开启档案\nOPEN("path", "mode") -> mode: "a"=附加, 不指定=覆写\nPRINT 必须在 OPEN 成功后才有效；同名档优先使用 Macro 资料夹内既有档案\n范例: OPEN("PROBE.NC");\nOPEN("COM"); 表示打开 RS232/RS485 传输埠（Pr3905 设定）' },
  { name: 'CLOSE',  sig: 'CLOSE()',    doc: '关闭由 OPEN 开启的档案\nCLOSE()\n程序结束后档案亦会自动关闭' },
  { name: 'PRINT',  sig: 'PRINT("text")', doc: '输出字符串到档案或传输埠\nPRINT("text")\n字符串中的变数名称会被替换为变数内容\n范例: PRINT("G01 X#3 Y@53 Z20.0");' },

  // ===== I/O 控制函数 =====
  { name: 'READDI',  sig: 'READDI(portNo)',   doc: '读取指定的 DI 点编号\nREADDI(portNo) -> 0/1\n有效版本：10.116.23\n参数: portNo=点编号(0~511)\n范例: #88 := READDI(11);' },
  { name: 'READDO',  sig: 'READDO(portNo)',   doc: '读取指定的 DO 点编号\nREADDO(portNo) -> 0/1\n有效版本：10.116.23\n范例: #88 := READDO(11);' },
  { name: 'SETDO',   sig: 'SETDO(portNo, val)', doc: '设定指定的 DO 点开/关\nSETDO(portNo, val)\n有效版本：10.116.23\nval: 1=开, 0=关\n范例: SETDO(3, 1);\n注意：DO 点编号范围 0~511；写入发生在插值阶段，避免与 PLC 写入同一点（后令覆盖前令）' },
  { name: 'READABIT', sig: 'READABIT(portNo)', doc: '读取指定的 A 点编号\nREADABIT(portNo) -> 0/1\n有效版本：10.116.44\n范例: #88 := READABIT(11);\n注意：A 点编号范围 0~511' },
  { name: 'SETABIT',  sig: 'SETABIT(portNo, val)', doc: '设定指定的 A 点开/关\nSETABIT(portNo, val)\n有效版本：10.116.44\nval: 1=开, 0=关\n注意：A 点编号范围 0~511；写入发生在插值阶段，避免与 PLC 写入同一点（后令覆盖前令）' },
  { name: 'READRREGBIT', sig: 'READRREGBIT(regNo, bit)', doc: '读取指定的 R 值编号及指定的 Bit\nREADRREGBIT(regNo, bit) -> 0/1\n有效版本：10.116.39\n参数: regNo=R值编号(0~65535), bit=指定Bit(0~31)\n范例: @52 := READRREGBIT(31, 3);' },
  { name: 'SETRREGBIT',  sig: 'SETRREGBIT(regNo, bit, val)', doc: '设定指定的 R 值编号、指定 Bit 的开/关\nSETRREGBIT(regNo, bit, val)\n有效版本：10.116.39\nval: 1=开, 0=关\n范例: SETRREGBIT(50, 3, 1);' },

  // ===== XML/Cycle 档案操作函数 =====
  { name: 'DBOPEN',   sig: 'DBOPEN("filename")',  doc: '开启既有的 Cycle 档案\nDBOPEN("filename") -> 资料个数(成功) / 0(失败)\n范例: DBOPEN("Test.cyc");\n同时间仅能开启一个 Cycle 档案' },
  { name: 'DBNEW',    sig: 'DBNEW("filename")', doc: '新增并开启全新的 Cycle 档案\nDBNEW("filename") -> 1(成功) / 0/-1/-2(失败)\n有效版本：10.118.56L+\n新档为空，须先 DBINSERT 才能 DBLOAD/DBSAVE；同时间只能开启一个 Cycle 档，后续 DBOPEN/DBNEW 会覆盖当前档案\n失败原因: -1=档名过长, -2=已存在' },
  { name: 'DBLOAD',   sig: 'DBLOAD(index)',  doc: '读取第 index 笔的 Cycle 资料\nDBLOAD(index) -> 1(成功) / 0(失败)\n范例: DBLOAD(0); 读取第0笔' },
  { name: 'DBSAVE',   sig: 'DBSAVE(index)', doc: '覆盖第 index 笔的 Cycle 资料\nDBSAVE(index) -> 1(成功) / 0(失败)\n有效版本：10.118.39+\n须先成功 DBOPEN/DBNEW 且 DBLOAD/DBINSERT；index 为非负整数且不超过资料范围，不支援图形模拟\n范例: DBSAVE(0);' },
  { name: 'DBINSERT', sig: 'DBINSERT(index, "name")', doc: '新增 Cycle 资料到第 index 笔\nDBINSERT(index, "CycleName") -> 1(成功) / 0/-1/-2/-3(失败)\n有效版本：10.118.56L+\n范例: DBINSERT(0, "WarmTest");' },
  { name: 'DBDELETE', sig: 'DBDELETE(index)', doc: '删除第 index 笔的 Cycle 资料\nDBDELETE(index) -> 1(成功) / 0/-1/-2(失败)\n有效版本：10.118.56L+\n范例: DBDELETE(0);' },

  // ===== 图形模拟函数 =====
  { name: 'SETDRAW',  sig: 'SETDRAW(color[, fill, radius])', doc: '定义图形模拟的画图样式\nSETDRAW(color) -> 原颜色值(可暂存恢复)\nSETDRAW(color, fill, radius)\n参数: color=路径颜色(BGR码), fill=填充颜色, radius=刀具半径\n范例: SETDRAW(255, 65280, 5);' },
  { name: 'DRAWHOLE', sig: 'DRAWHOLE()', doc: '在目前位置画一个圆（图形模拟内有效）\nDRAWHOLE()\n需配合 SETDRAW 定义的颜色和刀具半径' },

  // ===== 系统信息/检查函数 =====
  { name: 'ALARM',   sig: 'ALARM(id[, "msg"])', doc: '触发宏程序警报\nALARM(id) 或 ALARM(id, "msg")\n参数: id=警报ID(0~65535), msg=警报内容(中文≤19字,英文≤39字)\n会伴随触发警报 COR-027\n范例: ALARM(300); ALARM(301, "ALARM Content");' },
  { name: 'MSG',     sig: 'MSG([id, ]"text")', doc: '显示提示信息（可按 ESC 消除，程序结束时自动消失）\nMSG(id) 或 MSG("text") 或 MSG(id, "text")\n参数: id=提示ID(0~65535), text=提示内容\nMSG("text") 预设 ID：10.118.48U/10.118.52O/10.118.56I/10.118.60C/10.118.62+ 为 65535，之前版本为 -1\n范例: MSG("钻头遗失"); MSG(100, "钻头遗失");' },
  { name: 'WAIT',    sig: 'WAIT()',         doc: '系统停止预解，直到 WAIT 前指令执行完毕\nWAIT()\n确保 WAIT 前的 G/M 码执行完毕前不会继续预解\n注意：M98/M99/M198 不受 WAIT() 的等待保证\n常用于读取系统数据前挡预解' },
  { name: 'SLEEP',   sig: 'SLEEP()',        doc: '暂时放弃此次宏程序循环的执行权（约数十毫秒后恢复）\nSLEEP()\n防止迴圈耗尽 CPU 资源导致人机卡死\n执行后让出资源给人机介面等其他执行绪\n建议在 WHILE/FOR/REPEAT 循环中适时调用\n注意：SLEEP 仅对迴圈有效，放在 IF 中无实质作用\n与 WAIT 区别：WAIT 关闭预解确保读到最新系统状态，SLEEP 用于休息与资源分配' },
  { name: 'CHKMN',   sig: 'CHKMN("code")',  doc: '检查机械厂代码是否一致\nCHKMN("code") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #51 := CHKMN("5566");' },
  { name: 'CHKSN',   sig: 'CHKSN("sn")',    doc: '检查控制器序号是否一致\nCHKSN("sn") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #52 := CHKSN("M9A0001");' },
  { name: 'CHKMT',   sig: 'CHKMT("type")',  doc: '检查机床属性是否一致\nCHKMT("type") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #53 := CHKMT("MILL");' },
  { name: 'CHKMI',   sig: 'CHKMI("model")', doc: '检查控制器机型是否一致\nCHKMI("model") -> 1(一致) / 0(不符)\n目标版本：10.116.6A\n范例: #54 := CHKMI("S");' },
  { name: 'CHKINF',  sig: 'CHKINF(cat, "code")', doc: '检查代码与类别编号对应的内容是否一致\nCHKINF(cat, "code") -> 1(一致) / 0(不符)\n目标版本：10.118.22M+\ncat: 1=机械厂代码, 2=序号, 3=机床属性, 4=机型, 5=专机代码\n范例: #51 := CHKINF(1, "5566");' },
  { name: 'AXID',    sig: 'AXID("name")',     doc: '查询轴名称对应的轴编号（1基）\nAXID("name") -> 轴编号(整数) / VACANT(不存在)\n范例: AXID(Y) -> 2, AXID(Y2) -> 6' },

  // ===== 堆栈操作函数 =====
  { name: 'PUSH',   sig: 'PUSH(value)',      doc: '将资料塞进栈（Stack）\nPUSH(value)\n最先 PUSH 的值在栈最底层，依序往上叠加\n范例: PUSH(#1); PUSH(5);' },
  { name: 'POP',    sig: 'POP()',            doc: '从栈顶取出资料（由最上层取到最底层）\nPOP() -> 值\n注意：POP 会移除取出的栈顶资料\n范例: #1 := POP();' },
  { name: 'STKTOP', sig: 'STKTOP[index]',    doc: '复制栈中的资料（不删除）\nSTKTOP[index] -> 值\nindex 从 0 开始，STKTOP[0] 为最顶层\n范例: #1 := STKTOP[0];' }
];

/** 构建函数名索引 Map，key 为函数名（大写），value 为函数对象 */
exports.buildFunctionIndex = function() {
  const map = new Map();
  for (const fn of exports.functions) {
    map.set(fn.name, fn);
  }
  return map;
};