// syntec-macro v2.0.1 - functions.js
// 内置函数完整定义：补全数据 + Hover文档

exports.functions = [

  // ===== 数学函数 =====
  { name: 'ABS',   sig: 'ABS(num)',           doc: 'Returns absolute value\nABS(num) -> number\nExample: #3 := ABS(#2 - #1)' },
  { name: 'ACOS',  sig: 'ACOS(num)',           doc: 'Returns arccosine (radians)\nACOS(num) -> number' },
  { name: 'ASIN',  sig: 'ASIN(num)',           doc: 'Returns arcsine (radians)\nASIN(num) -> number' },
  { name: 'ATAN',  sig: 'ATAN(num)',           doc: 'Returns arctangent (radians)\nATAN(num) -> number' },
  { name: 'ATAN2', sig: 'ATAN2(y, x)',         doc: 'Returns arctangent of y/x (radians, quadrant-aware)\nATAN2(y, x) -> number' },
  { name: 'COS',   sig: 'COS(angle)',          doc: 'Returns cosine (radians)\nCOS(angle) -> number' },
  { name: 'SIN',   sig: 'SIN(angle)',          doc: 'Returns sine (radians)\nSIN(angle) -> number' },
  { name: 'TAN',   sig: 'TAN(angle)',          doc: 'Returns tangent (radians)\nTAN(angle) -> number' },
  { name: 'SQRT',  sig: 'SQRT(num)',           doc: 'Returns square root\nSQRT(num) -> number' },
  { name: 'CEIL',  sig: 'CEIL(num)',           doc: 'Rounds up\nCEIL(3.2) -> 4' },
  { name: 'FLOOR', sig: 'FLOOR(num)',          doc: 'Rounds down\nFLOOR(3.8) -> 3' },
  { name: 'ROUND', sig: 'ROUND(num)',          doc: 'Rounds to nearest integer\nROUND(3.5) -> 4' },
  { name: 'EXP',   sig: 'EXP(num)',            doc: 'Returns e to the power of n\nEXP(1) -> 2.718' },
  { name: 'LN',    sig: 'LN(num)',             doc: 'Returns natural logarithm\nLN(2.718) -> 1' },
  { name: 'LOG',   sig: 'LOG(num)',            doc: 'Returns common logarithm (base 10)\nLOG(100) -> 2' },
  { name: 'POW',   sig: 'POW(base, exp)',      doc: 'Returns power\nPOW(2, 3) -> 8' },
  { name: 'MAX',   sig: 'MAX(a, b)',            doc: 'Returns the larger value\nMAX(3, 5) -> 5' },
  { name: 'MIN',   sig: 'MIN(a, b)',            doc: 'Returns the smaller value\nMIN(3, 5) -> 3' },
  { name: 'SIGN',  sig: 'SIGN(num)',            doc: 'Returns sign (-1/0/1)\nSIGN(-5) -> -1' },
  { name: 'RANDOM', sig: 'RANDOM()',           doc: 'Returns random number between 0 and 1\nRANDOM() -> 0.732...' },

  // ===== 字符串函数 =====
  { name: 'STR2INT', sig: 'STR2INT(string)',   doc: 'Converts string to integer\nSTR2INT("123") -> 123\nOften used with SCANTEXT' },
  { name: 'SCANTEXT', sig: 'SCANTEXT(addr)',  doc: 'Reads string from memory address\nSCANTEXT(60001) -> string content\nparam: NC memory address (integer)\nreturns: string' },
  { name: 'CHR',    sig: 'CHR(code)',          doc: 'Converts ASCII code to character\nCHR(65) -> "A"' },
  { name: 'LEN',    sig: 'LEN(string)',        doc: 'Returns string length\nLEN("ABC") -> 3' },
  { name: 'MID',   sig: 'MID(str, start, len)', doc: 'Extracts substring\nMID("ABCDEF", 2, 3) -> "BCD"' },
  { name: 'STR',   sig: 'STR(num)',            doc: 'Converts number to string\nSTR(123) -> "123"' },
  { name: 'FORMAT', sig: 'FORMAT(fmt, val)',   doc: 'Formats number as string\nFORMAT("%.2f", #1)' },

  // ===== 参数/变量读写 =====
  { name: 'GETARG',    sig: 'GETARG(Xn)',     doc: 'Reads macro call argument\nGETARG(X1) -> arg #1 value\nparam: X1~X15 maps to A~O\nG65 P__ X1#1 -> #1 = GETARG(X1)' },
  { name: 'GETTRAPARG', sig: 'GETTRAPARG(n)', doc: 'Reads saved parameter when trap triggers\nGETTRAPARG(n)' },
  { name: 'PARAM',     sig: 'PARAM(type, idx)', doc: 'Reads NC system parameter\nPARAM(type, idx) -> number\ntype: 0=axis, 1=system, 2=pitch comp\nExample: #1 := PARAM(1, 1001)' },
  { name: 'SYSVAR',    sig: 'SYSVAR("name")', doc: 'Reads system variable\nSYSVAR("SYSTEM::NC_MODE") -> value\nExample: #1 := SYSVAR("SYSTEM::FEEDRATE")' },
  { name: 'SYSDATA',   sig: 'SYSDATA(axis)',  doc: 'Reads current axis position data\nSYSDATA(axis) -> number\naxis: X=0, Y=1, Z=2, A=3, B=4, C=5' },
  { name: 'DRVDATA',   sig: 'DRVDATA(axis)',  doc: 'Reads drive data\nDRVDATA(axis) -> number' },

  // ===== 文件 I/O =====
  { name: 'OPEN',   sig: 'OPEN(fileNo, path, mode)', doc: 'Opens file\nOPEN(1, "C:\\TEMP\\LOG.TXT", "W")\nmode: R=read, W=write, A=append\nreturns: 0=success, <0=failed' },
  { name: 'CLOSE',  sig: 'CLOSE(fileNo)',    doc: 'Closes file\nCLOSE(1)' },
  { name: 'PRINT',  sig: 'PRINT(fileNo, "text")', doc: 'Writes text to file\nPRINT(1, "Hello")\nPRINT(1, STR(#1)) writes variable value' },
  { name: 'READ',   sig: 'READ(fileNo, var)', doc: 'Reads one line from file into variable\nREAD(1, #var)' },
  { name: 'EXIST',  sig: 'EXIST("path")',    doc: 'Checks if file exists\nEXIST("C:\\TEMP\\DATA.TXT") -> 1=exists, 0=not found' },
  { name: 'DELETE', sig: 'DELETE("path")',   doc: 'Deletes file\nDELETE("C:\\TEMP\\OLD.TXT")' },
  { name: 'RENAME', sig: 'RENAME(old, new)',  doc: 'Renames file\nRENAME("A.TXT", "B.TXT")' },

  // ===== 数字量 I/O =====
  { name: 'READDI',  sig: 'READDI(port)',   doc: 'Reads digital input DI\nREADDI(1) -> 0 or 1\nport: DI port number (integer)' },
  { name: 'READDO',  sig: 'READDO(port)',   doc: 'Reads digital output DO\nREADDO(1) -> 0 or 1' },
  { name: 'SETDO',   sig: 'SETDO(port, val)', doc: 'Sets digital output\nSETDO(1, 1) -> DO1=1\nSETDO(1, 0) -> DO1=0' },
  { name: 'READABIT', sig: 'READABIT(port, bit)', doc: 'Reads specified bit of port\nREADABIT(1, 3) -> reads bit 3 of PORT1' },
  { name: 'SETABIT',  sig: 'SETABIT(port, bit, val)', doc: 'Sets specified bit of port\nSETABIT(1, 3, 1)' },
  { name: 'READRREGBIT', sig: 'READRREGBIT(reg)', doc: 'Reads register bit\nREADRREGBIT(reg)' },
  { name: 'SETRREGBIT',  sig: 'SETRREGBIT(reg, val)', doc: 'Sets register bit\nSETRREGBIT(reg, val)' },
  { name: 'READREG',  sig: 'READREG(regNo)', doc: 'Reads register value\nREADREG(1) -> value of register 1' },
  { name: 'SETREG',   sig: 'SETREG(regNo, val)', doc: 'Sets register value\nSETREG(1, 100)' },

  // ===== 刀具/坐标系 =====
  { name: 'TOOLSET', sig: 'TOOLSET(toolNo)', doc: 'Sets current tool number\nTOOLSET(5) -> switch to tool 5' },
  { name: 'STD',    sig: 'STD(ax)',          doc: 'Sets workpiece coordinate axis\nSTD(X) -> sets X axis' },
  { name: 'STDAX',  sig: 'STDAX(X, Y, Z)',   doc: 'Sets multiple axes simultaneously\nSTDAX(X, Y, Z)' },
  { name: 'SETCO',  sig: 'SETCO(coord)',     doc: 'Sets current coordinate system\nSETCO(1) -> G54\nSETCO(6) -> G59' },

  // ===== 数据库 =====
  { name: 'DBOPEN',   sig: 'DBOPEN("filename")',  doc: 'Opens database file\nDBOPEN("TOOL.DB")\nreturns: 0=success' },
  { name: 'DBCLOSE',  sig: 'DBCLOSE',        doc: 'Closes current database\nDBCLOSE' },
  { name: 'DBNEW',    sig: 'DBNEW("schema")', doc: 'Creates new database\nDBNEW("ID:I,NAME:S,LENGTH:D")' },
  { name: 'DBLOAD',   sig: 'DBLOAD(group)',  doc: 'Loads one record from database\nDBLOAD(groupNo)' },
  { name: 'DBSAVE',   sig: 'DBSAVE("filename")', doc: 'Saves database to file\nDBSAVE("TOOL.DB")' },
  { name: 'DBINSERT', sig: 'DBINSERT(group)', doc: 'Inserts one record into database\nDBINSERT(groupNo)' },
  { name: 'DBDELETE', sig: 'DBDELETE(group)', doc: 'Deletes current record\nDBDELETE(groupNo)' },
  { name: 'DBEDIT',   sig: 'DBEDIT(field, val)', doc: 'Edits current record field\nDBEDIT(2, "ToolName")' },

  // ===== 仿真/绘图 =====
  { name: 'SETDRAW',  sig: 'SETDRAW(mode, color)', doc: 'Sets tool path drawing mode\nSETDRAW(0, 1) -> mode: 0=off, 1=solid, 2=dashed\ncolor: color code' },
  { name: 'DRAWHOLE', sig: 'DRAWHOLE(x, y, r)', doc: 'Draws drilling path\nDRAWHOLE(X, Y, R)' },

  // ===== 系统/诊断 =====
  { name: 'ALARM',   sig: 'ALARM(no, "msg")', doc: 'Triggers alarm and pauses program\nALARM(1001, "Tool not ready")\nno: alarm number\nmsg: display message' },
  { name: 'MSG',     sig: 'MSG("text")',     doc: 'Displays message on screen (non-blocking)\nMSG("Progress: " + STR(#1) + "%")' },
  { name: 'WAIT',    sig: 'WAIT(ms)',         doc: 'Wait (milliseconds)\nWAIT(2000) -> wait 2 seconds' },
  { name: 'SLEEP',   sig: 'SLEEP(sec)',       doc: 'Wait (seconds)\nSLEEP(1) -> wait 1 second\nWAIT vs SLEEP: WAIT=ms, SLEEP=s' },
  { name: 'CHKMI',   sig: 'CHKMI',           doc: 'Checks if M code is active\nCHKMI -> 0=inactive, 1=active' },
  { name: 'CHKMN',   sig: 'CHKMN(Mnn)',       doc: 'Checks if specified M code exists\nCHKMN(98) -> 1=exists' },
  { name: 'CHKSN',   sig: 'CHKSN(Snn)',       doc: 'Checks S code\nCHKSN(1000)' },
  { name: 'CHKMT',   sig: 'CHKMT(Tnn)',       doc: 'Checks T code\nCHKMT(5)' },
  { name: 'CHKINF',  sig: 'CHKINF(axis)',     doc: 'Checks axis info\nCHKINF(X)' },
  { name: 'AXID',    sig: 'AXID("name")',     doc: 'Gets axis ID number\nAXID("X") -> 0' },

  // ===== 堆栈 =====
  { name: 'PUSH',   sig: 'PUSH(value)',      doc: 'Pushes value onto stack\nPUSH(#1)' },
  { name: 'POP',    sig: 'POP()',            doc: 'Pops value from top of stack\n#1 := POP()' },
  { name: 'STKTOP', sig: 'STKTOP()',         doc: 'Reads top of stack without popping\n#1 := STKTOP()' },

  // ===== 刀具路径 =====
  { name: 'ARC',   sig: 'ARC(X, Y, I, J)',   doc: 'Draws arc path (simulation)\nARC(X, Y, I, J)\nI,J=relative center coordinates' },
  { name: 'LINE',  sig: 'LINE(X, Y)',        doc: 'Draws straight line path (simulation)\nLINE(X, Y)' },

  // ===== 其他 =====
  { name: 'BITAND',  sig: 'BITAND(a, b)',   doc: 'Bitwise AND\nBITAND(5, 3) -> 1' },
  { name: 'BITOR',   sig: 'BITOR(a, b)',    doc: 'Bitwise OR\nBITOR(5, 3) -> 7' },
  { name: 'BITXOR',  sig: 'BITXOR(a, b)',   doc: 'Bitwise XOR\nBITXOR(5, 3) -> 6' },
  { name: 'BITNOT',  sig: 'BITNOT(a)',      doc: 'Bitwise NOT\nBITNOT(5)' },
  { name: 'INLIST',  sig: 'INLIST(val, a, b, c...)', doc: 'Checks if value is in list\nINLIST(#1, 1, 2, 3, 4, 5)' },
  { name: 'PI',      sig: 'PI()',           doc: 'Returns pi\nPI() -> 3.14159...' },
  { name: 'DEG',     sig: 'DEG(rad)',        doc: 'Radians to degrees\nDEG(3.14159) -> 180' },
  { name: 'RAD',     sig: 'RAD(deg)',        doc: 'Degrees to radians\nRAD(180) -> 3.14159' },
  { name: 'MOD',     sig: 'MOD(a, b)',       doc: 'Modulo (remainder)\nMOD(10, 3) -> 1' },
];