%@MACRO

// ============================================================
// syntec-macro v2.7.0 syntax coverage demo
// AI 参考用：覆盖新代 MACRO 常用语法形态；请勿直接上机执行
// ============================================================

// --- 0. 速查规则 ---
// 变量：区域 #1~#400(计算用)；系统 #1000~#31986；公用 @ 依区间开放，最高 @165535。
// 引数：A=#1 B=#2 C=#3 I=#4 J=#5 K=#6 D=#7 E=#8 F=#9 H=#11 L=#12 M=#13 P=#16 Q=#17 R=#18 S=#19 T=#20 U=#21 V=#22 W=#23 X=#24 Y=#25 Z=#26。
// 扩充引数如 X1/Y1/A1 使用 GETARG(X1)/GETARG(Y1)/GETARG(A1)。
// #0/@0 为 VACANT；客制参数 #4001~#4100、#5001~#5500 只读。
// 模态变量：#1080~#1099 Long/断电消失；#2001~#2200、#3001~#3100 Double/复位消失。
// 公用变量：@1~@400 Double；@656~@999、@1001~@1999 记忆性 Double；@1000 只读。
// R 映射：@401~@655 -> R1~R255，@10000~@14095 -> R0~R4095，@100000~@165535 -> R0~R65535。
// 可写 R 范围：R50~R80、R101~R511、R1024~R4095、R5800~R7999、R10000~R10999、R15000~R65535。
// @60000~@79999 为扩充公用变量。未列区间不可视为可用。
// Long 与 Double 混合四则运算会转为 Double；

// --- 1. 变量与赋值 ---
#1 := 100;                       // 区域变量 / A 引数
#24 := 200;                      // 区域变量 / X 引数
#27 := #1 + #24;
#400 := 300;                     // 区域变量上限

@1 := 500;                       // 一般运算 Double
@450 := 600;                     // R50 映射 Long，可写
@656 := 700;                     // 记忆性 Double
@1001 := 750;                    // 记忆性 Double
@11024 := 800;                   // R1024 映射 Long，可写
@60000 := 850;                   // 扩充公用变量
@165535 := 900;                  // R65535 映射 Long
#122 := @1000;                  // @1000 只读

@2 := 1;                         // Long
@3 := 2.0;                       // Double
@4 := @2 + @3;                   // Long + Double -> Double
@5 := 2;
@6 := 100;
@7 := @5 * @6;                   // Long * Long -> Long
#123 := 4;                       // 推荐赋值写法

#3 := 123;
@[#3] := 567;
@[#3+7] := 890;
#[10+#3] := @[#3+7];
IF #[10+#3] <> #0 THEN
  #124 := #[10+#3];
END_IF;

AR1 := 789;
MAR1 := 789;
AR[#3] := 789;
MAR[#3] := 789;

#1000 := 1;                      // 系统变量
#1080 := 1;                      // 模态 Long，仅整数，断电消失
#2001 := 1.5;                    // 模态 Double，复位消失
#3001 := 2.5;                    // 模态 Double，复位消失
#120 := #4001;                   // 客制参数只读
#121 := #5001;                   // 客制参数只读
$1;                              // 轴群识别

// --- 2. 控制流与跳转 ---
IF #1 > 50 THEN
  #10 := 1;
ELSEIF #1 > 20 THEN
  #10 := 2;
ELSE
  #10 := 3;
END_IF;

FOR #1 := 1 TO 10 BY 2 DO
  #2 := #2 + #1;
END_FOR;

#5 := 0;
WHILE #5 < 5 DO
  #5 := #5 + 1;
END_WHILE;

#6 := 0;
REPEAT
  #6 := #6 + 1;
  IF #6 > 3 THEN
    EXIT;
  END_IF;
UNTIL #6 >= 5 END_REPEAT;

CASE #10 OF
  1:
    #11 := 100;
  2, 3:
    #11 := 200;
  ELSE
    #11 := 0;
END_CASE;

IF #1 = 100 THEN
  #13 := 1;
END_IF;
FOR #1 := 1 TO 5 DO
  #14 := #1;
END_FOR;
WHILE #1 > 0 DO
  #1 := #1 - 1;
END_WHILE;

N100;
GOTO 200;
N200;
#20 := 1;

// --- 3. 运算符 ---
#30 := 1 + 2;
#31 := 10 - 3;
#32 := 4 * 5;
#33 := 20 / 4;
#34 := 100 MOD 7;
#35 := 1 / 2; // 整数除法，结果为 0
#36 := 1 / 2.0; //结果为 0.5
#37 := 1. / 2;

IF #1 > 50 THEN 
  #40 := 1;
ELSEIF #1 >= 20 THEN
  #40 := 2;
ELSEIF #1 < 10 THEN
  #40 := 3;
ELSEIF #1 <= 5 THEN
  #40 := 4;
ELSEIF #1 = 100 THEN
  #40 := 5;
ELSEIF #1 <> 300 THEN
  #40 := 6;
ELSEIF (#1 > 10) & (#2 < 50) THEN
  #40 := 7;
ELSEIF (#1 = 100) AND (#2 = 200) THEN
  #40 := 8;
ELSEIF (#1 > 0) OR (#2 > 0) THEN
  #40 := 9;
ELSEIF NOT (#1 = 0) THEN
  #40 := 10;
ELSEIF (#1 > 0) XOR (#2 > 0) THEN
  #40 := 11;
ELSE
  #40 := 0;
END_IF;


// --- 4. 内置函数 ---
#60 := ABS(#1 - #2);
#61 := ACOS(0.5);
#62 := ASIN(0.5);
#63 := ATAN(1.0);
#64 := ATAN2(1.0, 1.0);
#65 := COS(180);
#66 := SIN(90);
#67 := TAN(45);
#68 := SQRT(144);
#69 := CEIL(3.2);
#70 := FLOOR(3.8);
#71 := ROUND(3.5);
#72 := EXP(1);
#73 := LN(100);
#75 := POW(16, 0.5);
#76 := MAX(3, 5);
#77 := MIN(3, 5);
#78 := SIGN(-5);
#79 := RANDOM();

#94 := STR2INT("456");
#96 := SCANTEXT(1);

#100 := PARAM(3204);
#101 := PARAM(20001, 2);
#102 := SYSVAR(1, 1000);
#103 := SYSDATA(336);
#104 := DRVDATA(1000, 3366);
#105 := GETARG(X1);
#106 := GETTRAPARG(X);
#107 := GETPR(3500);
#108 := GETARG(A1);
SETPR(3500, #107);

#110 := STD(#9, #1600);
#111 := STDAX(#3, A);

OPEN("PROBE.NC");
OPEN("LOG.TXT", "a");
PRINT("G01 X#3 Y@53");
CLOSE();

#130 := READDI(31);
#131 := READDO(11);
SETDO(3, 1);
#132 := READABIT(31);
SETABIT(3, 1);
#134 := READRREGBIT(31, 3);
SETRREGBIT(50, 3, 1);

DBOPEN("Test.cyc");
#200 := DBOPEN("Test.cyc");
DBNEW("WarmTest_20220621");
DBLOAD(0);
DBSAVE(0);
DBINSERT(0, "WarmTest");
DBDELETE(0);

#250 := SETDRAW(255, 65280, 5);
DRAWHOLE();

ALARM(300);
ALARM(301, "ALARM Content");
MSG(100);
MSG("钻头遗失");
MSG(100, "钻头遗失");
WAIT();
SLEEP();
#260 := CHKMN("5566");
#261 := CHKSN("M9A0001");
#262 := CHKMT("MILL");
#263 := CHKMI("S");
#264 := CHKINF(1, "5566");
#265 := AXID(Y);

PUSH(#1);
#150 := POP();
#151 := STKTOP[0];

// --- 5. 子程序与宏调用 ---
G65 P1000 L1 X100. Y50. A20.;
G65 P#3;
G65 P"PCSubProg1";
G65.1 P1000 X100. Y50. A20.;
G66 P1000 L1;
G67;
G66.1 P1000 L1;
G67;
M98 P1000 H2 L1;
M198 P2000 H1;
M96 P3000 H1;
M97;

// --- 6. 机器人与应用指令 ---
MOVJ C1=0 C2=0 C3=90 C4=0 C5=0 C6=0 A1=0 FJ50 FEJ100 PL0 ACC80 DEC90;
MOVJ C1=10 C2=20 C3=30 C4=40 C5=50 C6=60 A1=0 A2=0 FJ50 FEJ100 PL3 ACC80 DEC90;
MOVJ X100. Y0. Z50. A0. B0. C0. A1=0 P1 Q1 FJ50 FEJ100 PL10;
MOVL X200. Y100. Z50. A0. B0. C0. A1=0 P1 Q1 FL100. FR10. FEJ100;
MOVL X210. Y110. Z55. A0. B0. C0. A1=0 P1 Q1 FL120. FR12. FEJ100;
MOVL X220. Y120. Z60. A0. B0. C0. A1=0 P1 Q1 FL120. FR12. FEJ100 PQ5;
MOVC X150. Y50. Z0. A0. B0. C0. A1=0 FL100. FR10. FEJ100 PL3 ACC80 DEC90;
MOVC X200. Y100. Z0. A0. B0. C0. A1=0 FL100. FR10. FEJ100 PL3 ACC80 DEC90;
MOVC X1=100. Y1=50. Z1=20. A1=0 B1=0 C1=0 X2=150. Y2=80. Z2=30. A2=0 B2=0 C2=0 FL100. FR10. FEJ100 PR3 ACC80 DEC90;
INCMOVJ C1=10. C2=5. C3=0 C4=0 C5=0 C6=0 A1=0 Q1 FJ30 FEJ100 PL2 DEC90;
INCMOVL P1 X50. Y20. Z10. A0. B0. C0. A1=0 Q1 FL80. FR10. FEJ100 PL2 ACC80;

USERCOR P1;
G68.18 P1 R0 X10. Y20. Z30. A0. B0. C0.;
OBJCORON X5. Y0. Z0. A0. B0. C0.;
OBJCOROFF;
OBJCORCLEAR;
G43.16 P1 X10. Y20. Z30. A0. B0. C0.;
TOOLCOR P1;
TOOLCOR P2;
TOOLCOROFF;
TOOLCOR P0;

SKIPCOND E1 Q33 R1 P1;
MOVL X100. Y0. Z0. SKIP;
G04.102 I1 X1000;
SWAITSIG P1 Q33 R1 L100 T5000;
SYNCOUT S1 Q1 P50 R1 K0;
SYNCOUT S1 Q1 P100 R0 K0;
WEAVEON P1;
WEAVEON E2.0 Q1.0 K45 L100 R0;
WEAVEOFF;
STITCHON S1 Q100 L50 E10.;
STITCHOFF;
POSEMAP X100. Y0. Z50. A0. B0. C0. Q1 R1;
SHIFTON P1 X5. Y0. Z0. A0. B0. C0.;
SHIFTOFF;
G192.1 P1 Q100 R1 E5;
G192.2;
WAITSYNC P1 L100;
ENDSYNC P1;
CIRMODE P1;
G141.2 P1;
G142.101 P1 X0. Y0. Z0. X1=100. Y1=0. Z1=0. X2=0. Y2=100. Z2=0.;
G142.102 P1 X0. Y0. Z0. A0. B0. C0.;
G142.2 P1 Q1 R5.;
G142.3 P1;
G143.1 P1;
G144.1 P1;
G144.2 P1;
G144.103 P1 Q5;
G144.104 P1;
G145.1 P1 Q10.;
G145.2 P1;
PAUSE;
ACC 80;
DEC 90;

// --- 7. G/M 码形态 ---
G00 X0. Y0.;
G01 X100. Y50. F1000.;
G02 X150. Y100. I50. J0.;
G03 X100. Y50. I-50. J0.;
G04 X1000;
G31 X10. Y10. F100.;
G01 X100. Y100., C10.;
G01 X120. Y120., R10.;
G01 X140. Y140., A45.;

G96 S120;
G97 S1000;

G73 X0. Y0. Z-10. R2. Q1. F100.;
G81 X0. Y0. Z-10. R2. F100.;
G83 X0. Y0. Z-20. R2. Q2. F100.;
G84 X0. Y0. Z-10. R2. F100.;
G80;

G10 L1000 R1 100;
G90 G10 L1000 P18851 R(#100);
G10 L1805 I#11 Q#12 R#13 J(#14);
G04.1 P1;
G04.102 I1 X100;
G01.101 P1 X10. Y0. Z0. FL100.;
G01.102 X200. Y0. Z0. FL120.;
G04.101 P1;
G04.103 P1;
G10.101 P1 Q2 R3;
G11.101 P1;
G11.102 P1;
G11.103 P1;
G12.101 P1 Q1;
G52.101 P1 X10. Y20. Z30.;
G53.101 P1 X10. Y0. Z0. FJ30;
G53.102 X100. Y0. Z50. A0. B0. C0. FJ50;
G68.18 P1 X10. Y20. Z30.;
G193.110 I#1 Q#2 R#3 J(#5 + #7);

M00;
M03 S1000;
M04 S1000;
M06 T1;
M#4;

// --- 8. 注释与综合场景 ---
#200 := 1; // 行尾注释

(*
  多行块注释
  IF / END_IF / GOTO 等关键字在注释中不参与诊断
*)

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
WHILE #203 < 10 DO
  CASE #203 OF
    0:
      MOVJ C1=#203 C2=0 FJ50;
    1:
      MOVL X#203 Y0. Z0. FL100.;
    2:
      INCMOVJ C1=5. C2=0 C3=0 C4=0 C5=0 C6=0 FJ30;
    ELSE
      PAUSE;
  END_CASE;
  #203 := #203 + 1;
  SLEEP();
END_WHILE;

M99;
