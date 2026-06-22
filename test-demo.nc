%@MACRO

// ============================================================
// syntec-macro v2.5.0 插件功能验证测试文件
// 基于《新代控制器技术参考手册》全覆盖测试
// 涵盖：变量系统、控制流、运算符、函数、机器人指令、G/M码
// ============================================================

// --- 1. 变量系统 ---
// 1.1 区域变量 # (直接赋值)
#1 := 100;
#2 := 200;
#26 := 300;

// 1.2 公用变量 @ (直接赋值)
@1 := 500;
@1000 := 600;
@10000 := 700;

// 1.3 间接赋值 (中括号语法)
#3 := 123;
@[#3] := 567;
@[#3 + 7] := 890;

// 1.4 App 专用变量 AR / MAR
AR1 := 789;
MAR1 := 789;
AR[#3] := 789;
MAR[#3] := 789;

// 1.5 系统变量
#1000 := 1;
#1002 := 17;
#1004 := 90;
#1040 := 1;
#1046 := 1000;

// 1.6 轴群辨识符号
$1;
$2;
$3;
$4;

// --- 2. 控制流 ---
// 2.1 IF / ELSEIF / ELSE
IF #1 > 50 THEN
  #10 := 1;
ELSEIF #1 > 20 THEN
  #10 := 2;
ELSE
  #10 := 3;
END_IF;

// 2.2 FOR 循环 (带 BY 步进)
FOR #1 := 1 TO 10 BY 2 DO
  #2 := #2 + #1;
END_FOR;

// 2.3 WHILE 循环
#5 := 0;
WHILE #5 < 5 DO
  #5 := #5 + 1;
END_WHILE;

// 2.4 REPEAT / UNTIL 循环
#6 := 0;
REPEAT
  #6 := #6 + 1;
  IF #6 > 3 THEN
    EXIT;
  END_IF;
UNTIL #6 >= 5
END_REPEAT;

// 2.5 CASE 分支 (冒号语法 + ELSE)
#10 := 2;
CASE #10 OF
  1: #11 := 100;
  2: #11 := 200;
  3: #11 := 300;
  ELSE: #11 := 0;
END_CASE;

// 2.6 CASE 多值分支
CASE #10 OF
  1, 2: #12 := 10;
  3, 4: #12 := 20;
  ELSE: #12 := 0;
END_CASE;

// 2.7 短形式结束标记
IF #1 = 100 THEN
  #13 := 1;
ENDIF;

FOR #1 := 1 TO 5 DO
  #14 := #1;
ENDFOR;

WHILE #1 > 0 DO
  #1 := #1 - 1;
ENDWHILE;

// 2.8 嵌套 (多层)
IF #1 > 0 THEN
  IF #2 > 0 THEN
    IF #3 > 0 THEN
      #15 := 1;
    END_IF;
  END_IF;
END_IF;

// --- 3. GOTO 跳转 ---
N100;
GOTO 200;

N200;
#20 := 1;

// --- 4. 运算符 ---
// 4.1 算术运算符
#30 := 1 + 2;
#31 := 10 - 3;
#32 := 4 * 5;
#33 := 20 / 4;
#34 := 100 MOD 7;

// 4.2 整数除法陷阱
#35 := 1 / 2;
#36 := 1 / 2.0;
#37 := 1. / 2;

// 4.3 比较运算符
IF #1 > 50 THEN
  #40 := 1;
END_IF;
IF #1 >= 100 THEN
  #41 := 1;
END_IF;
IF #1 < 200 THEN
  #42 := 1;
END_IF;
IF #1 <= 100 THEN
  #43 := 1;
END_IF;
IF #1 = 100 THEN
  #44 := 1;
END_IF;
IF #1 <> 200 THEN
  #45 := 1;
END_IF;

// 4.4 逻辑运算符
IF (#1 > 10) & (#2 < 50) THEN
  #46 := 1;
END_IF;
IF (#1 = 100) AND (#2 = 200) THEN
  #47 := 1;
END_IF;
IF (#1 > 0) OR (#2 > 0) THEN
  #48 := 1;
END_IF;
IF NOT (#1 = 0) THEN
  #49 := 1;
END_IF;
IF (#1 > 0) XOR (#2 > 0) THEN
  #50 := 1;
END_IF;

// --- 5. 数学函数 ---
#60 := ABS(#1 - #2);
#61 := ACOS(0.5);
#62 := ASIN(0.5);
#63 := ATAN(1.0);
#64 := ATAN2(1.0, 1.0);
#65 := COS(3.14159);
#66 := SIN(3.14159);
#67 := TAN(0.785);
#68 := SQRT(144);
#69 := CEIL(3.2);
#70 := FLOOR(3.8);
#71 := ROUND(3.5);
#72 := EXP(1);
#73 := LN(2.718);
#74 := LOG(100);
#75 := POW(2, 3);
#76 := MAX(3, 5);
#77 := MIN(3, 5);
#78 := SIGN(-5);
#79 := RANDOM();
#80 := PI();
#81 := DEG(3.14159);
#82 := RAD(180);

// --- 6. 字符串函数 ---
#90 := LEN("ABCDEF");
#91 := MID("ABCDEF", 2, 3);
#92 := STR(123);
#93 := CHR(65);
#94 := STR2INT("456");
#95 := FORMAT("%.2f", #1);
// SCANTEXT 需要记忆体位址参数
// #96 := SCANTEXT(60001);

// --- 7. 参数/变量读写函数 ---
#100 := PARAM(1, 1001);
#101 := SYSVAR("SYSTEM::NC_MODE");
#102 := SYSDATA(0);
#103 := DRVDATA(0);
#104 := GETPR(3500);
SETPR(3500, #104);
// GETARG 读取宏程序引数 (需在 G65 呼叫的宏程序内使用)
// #105 := GETARG(X1);
// GETTRAPARG 读取中断触发时参数
// #106 := GETTRAPARG(1);

// --- 8. 文件 I/O 函数 ---
// OPEN(1, "C:\\TEMP\\LOG.TXT", "W");
// PRINT(1, "Hello World");
// PRINT(1, STR(#1));
// READ(1, #110);
// CLOSE(1);
#120 := EXIST("C:\\TEMP\\DATA.TXT");
// DELETE("C:\\TEMP\\OLD.TXT");
// RENAME("A.TXT", "B.TXT");

// --- 9. 数字量 I/O 函数 ---
#130 := READDI(1);
#131 := READDO(1);
SETDO(1, 1);
SETDO(1, 0);
#132 := READABIT(1, 3);
SETABIT(1, 3, 1);
// READRREGBIT / SETRREGBIT
#133 := READREG(1);
SETREG(1, 100);

// --- 10. 刀具/坐标系函数 ---
TOOLSET(5);
// STD(X);
// STDAX(X, Y, Z);
SETCO(1);

// --- 11. 数据库函数 ---
// DBOPEN("TOOL.DB");
// DBNEW("ID:I,NAME:S,LENGTH:D");
// DBLOAD(1);
// DBINSERT(1);
// DBEDIT(2, "ToolName");
// DBDELETE(1);
// DBSAVE("TOOL.DB");
// DBCLOSE;

// --- 12. 仿真/绘图函数 ---
SETDRAW(1, 1);
// DRAWHOLE(100, 200, 50);
// ARC(100, 200, 50, 0);
// LINE(100, 200);

// --- 13. 系统/诊断函数 ---
ALARM(1001);
ALARM(1002, "Drill broken");
MSG(100);
MSG("Test message");
MSG(200, "Custom msg");
SLEEP(100);
// WAIT(2000);
// CHKMI;
// #140 := CHKMN(98);
// #141 := CHKSN(1000);
// #142 := CHKMT(5);
// #143 := CHKINF(0);
// #144 := AXID("X");

// --- 14. 堆栈函数 ---
PUSH(#1);
#150 := POP();
#151 := STKTOP();

// --- 15. 位元运算函数 ---
#160 := BITAND(5, 3);
#161 := BITOR(5, 3);
#162 := BITXOR(5, 3);
#163 := BITNOT(5);
#164 := INLIST(#1, 1, 2, 3, 4, 5);

// --- 16. 子程序呼叫 ---
// 16.1 G65 单一宏程序呼叫 (引数存入 #1~#26)
G65 P1000 L1 X100. Y50. A20.;

// 16.2 G66 模式宏程序呼叫
G66 P1000 L1;
G67;

// 16.3 G66.1 模式宏程序呼叫
G66.1 P1000 L1;
G67;

// 16.4 M98 子程序呼叫
M98 P1000 H2 L1;

// 16.5 M198 子程序呼叫 (另一路径)
M198 P2000 H1;

// 16.6 M99 返回
// M99;
// M99 P100;
// M99 Q200;

// 16.7 M96/M97 中断程序
M96 P3000 H1;
M97;

// --- 17. 机器人移动指令 ---
// 17.1 MOVJ 关节运动
MOVJ C1=0 C2=0 C3=90 C4=0 C5=0 C6=0 FJ=50 PL=5 ACC=80 DEC=90;

// 17.2 MOVJ-II 关节运动 (末端位置输入)
MOVJ-II X=100. Y=0. Z=50. A=0. B=0. C=0. FJ=50 PL=3;

// 17.3 MOVL 末端直线运动
MOVL X=200. Y=100. Z=50. FL=100. FR=10. PL=3 ACC=80 DEC=90;

// 17.4 MOVC 圆弧运动
MOVC Xp=150. Yp=50. Zp=0. X=200. Y=100. Z=0. FL=100. PL=3;

// 17.5 INCMOVJ 增量关节运动
INCMOVJ C1=10. C2=5. FJ=30 PL=2;

// 17.6 INCMOVL 增量直线运动
INCMOVL X=50. Y=20. Z=10. FL=80. PL=2;

// --- 18. 坐标系指令 ---
// 18.1 用户坐标系
USERCOR P1;

// 18.2 G68.18 设定用户坐标系
G68.18 P1 X10. Y20. Z30. A0. B0. C0.;

// 18.3 工件坐标系 (叠加层)
OBJCORON X5. Y0. Z0. A0. B0. C0.;
OBJCOROFF;
OBJCORCLEAR;

// 18.4 工具坐标系
TOOLCOR T1;
TOOLCORON T2;
TOOLCOROFF;
TOOLCOR CLEAR;

// --- 19. 应用指令 ---
// 19.1 跳脱功能
SKIPCOND E1 Q33 R1 P1;
MOVL X=100. Y=0. Z=0. SKIP;

// 19.2 等待计时
G04.102 I1 X1000;

// 19.3 等待讯号不减速
SWAITSIG P1 Q33 R1 L100 T5000;

// 19.4 进阶输出
SYNCOUT S1 Q1 P50 R1;
MOVL X=100. Y=0. Z=0.;
SYNCOUT S1 Q1 P100 R0;

// 19.5 摆动指令
WEAVEON P1;
WEAVEON E2.0 Q1.0 K45 L100 R0;
WEAVEOFF;

// 19.6 连续脉冲输出
STITCHON S1 Q100 L50 E10.;
STITCHOFF;

// 19.7 坐标转换
POSEMAP X=100. Y=0. Z=50. A=0. B=0. C=0. Q1 R1;

// 19.8 点位偏移
SHIFTON P1 X5. Y0. Z0. A0. B0. C0.;
SHIFTOFF;

// 19.9 末端追踪
G192.1 P1 Q100 R1 E5;
G192.2;

// 19.10 暂停
PAUSE;

// 19.11 加减速度 (单独使用)
ACC 80;
DEC 90;

// --- 20. G 码测试 ---
G00 X0. Y0.;
G01 X100. Y50. F1000.;
G02 X150. Y100. I50. J0.;
G03 X100. Y50. I-50. J0.;
G04 X1000;
G09 X100.;
G10 L1000 R1 100;
G10 L1021 P1 D100;
G10 L1805 O1 R1 J500;
G10 L1900 P1 D100;
G10 L1901 P1 D100;
G10 L1910 P1 D100;
G10 L1911 P1 D100;
G17;
G18;
G19;
G20;
G21;
G28;
G30;
G40;
G41;
G42;
G43;
G49;
G53;
G54;
G55;
G56;
G57;
G58;
G59;
G65 P1000;
G66 P1000;
G67;
G68;
G69;
G90;
G91;
G94;
G95;
G04.1 P1;
G04.102 I1 X100;
G68.18 P1 X10. Y20. Z30.;
G192.1 P1 Q100 R1;
G192.2;

// --- 21. M 码测试 ---
M00;
M01;
M02;
M03 S1000;
M04 S1000;
M05;
M06 T1;
M07;
M08;
M09;
M30;
M96 P3000 H1;
M97;
M98 P1000 H1 L1;
M99;
M198 P2000 H1;

// --- 22. 注释测试 ---
// 单行注释
#200 := 1; // 行尾注释

(*
  多行块注释
  用于测试跨行注释处理
  确保括号匹配不受影响
*)

// --- 23. 中文字符检测 ---
// 注释中的中文是允许的
// 变量赋值不能包含中文
#201 := 100;

// --- 24. 复杂嵌套场景 ---
// 综合测试: 控制流 + 函数 + 运算符
FOR #1 := 1 TO 10 BY 1 DO
  IF #1 > 5 THEN
    #202 := SQRT(POW(#1, 2));
    IF #202 > 7 THEN
      GOTO 300;
    END_IF;
  ELSE
    #202 := #1 * 2;
  END_IF;
END_FOR;

N300;
#203 := 0;

// 综合测试: WHILE + CASE + 机器人指令
WHILE #203 < 10 DO
  CASE #203 OF
    0: MOVJ C1=#203 C2=0 FJ=50;
    1: MOVL X=#203 Y=0. Z=0. FL=100;
    2: INCMOVJ C1=5. FJ=30;
    ELSE: PAUSE;
  END_CASE;
  #203 := #203 + 1;
  SLEEP(100);
END_WHILE;

M99;
