# แผนเพิ่ม Reaction Roles แบบเลือกหลายยศ

สถานะ: ผู้ใช้อนุมัติแล้ว ดำเนินการเสร็จและตรวจผ่าน ดู walkthrough.md

## รูปแบบใช้งาน
- เพิ่ม `/set reaction-role setup` สำหรับทีมงาน เลือก `channel`, `title`, `emoji1`, `role1` และคำอธิบาย `description` ที่ไม่บังคับ
- เพิ่มคู่ `emoji2`/`role2` จนถึง `emoji10`/`role10` แบบไม่บังคับ สูงสุด 10 คู่ต่อข้อความ สร้างได้หลายข้อความ
- สมาชิกกดหลายอิโมจิเพื่อรับหลายยศ เอาอิโมจิออกเพื่อถอดเฉพาะยศที่ผูกไว้ ตามที่ตกลง ไม่ตรวจแหล่งที่ได้รับยศเดิม
- รองรับอิโมจิมาตรฐานและ custom emoji ที่บอทเข้าถึงได้ ใช้อิโมจิเฉพาะตัวเลือกที่ผู้ใช้ขอ ข้อความ success/error และหัวข้อที่ระบบกำหนดใช้ข้อความธรรมดา
- บันทึกการจับคู่ตาม message ID แยกแต่ละเซิร์ฟเวอร์ เมื่อ restart ข้อความเดิมยังทำงานสำหรับ reaction events ใหม่

## ไฟล์และการเปลี่ยนแปลง
1. `src/events/ready.js`: เพิ่ม subcommand group และ setup options ให้ required options มาก่อน optional ใช้ขีดจำกัดความยาว title/description ตรวจจำนวน options และขนาดคำสั่งทั้งหมดตามข้อกำหนด Discord
2. `src/events/interactionCreate.js`: ส่งคำสั่งกลุ่มใหม่ไป handler ใช้ defer และ response helper เดิม ตรวจสิทธิ์ Manage Roles เพิ่มเติมจากสิทธิ์ตั้งค่าที่มีอยู่
3. ไฟล์ใหม่ `src/commands/set/setReactionRole.js`: รับคู่ emoji/role ตรวจว่าครบคู่ ไม่ซ้ำกัน และ role แต่ละตัวอยู่ต่ำกว่าทั้งบอทและผู้สร้าง (ยกเว้นเจ้าของเซิร์ฟเวอร์) ห้าม managed role/@everyone
4. Handler ใหม่ตรวจสิทธิ์ห้อง View Channel, Send Messages, Embed Links, Read Message History และ Add Reactions ส่ง embed ผ่านบอทโดยตรง ใส่คำแนะนำและรายการ emoji/role และเติม reactions ตั้งต้น การสร้างต้องสำเร็จทั้งการส่ง การเติม emoji และการบันทึกจึงตอบ Success พร้อมลิงก์ข้อความ
5. หากสร้างไม่ครบ ให้พยายามลบข้อความใหม่และคืนการตั้งค่ารายการนั้น รายงานความล้มเหลวพร้อมลิงก์เมื่อเก็บกวาดไม่สำเร็จ ไม่แจ้ง Success เกินจริง
6. `src/utils/db.js`: เพิ่ม getter/save สำหรับ config `database/<guildId>/reaction-roles.json` รูปแบบเดียวตาม message ID มี channel ID และคู่ emoji key/role ID ใช้ helper JSON เดิม เก็บ config ในหน่วยความจำเพื่อลดการอ่านซ้ำ และอัปเดต cache หลัง save สำเร็จ ข้อความที่ไม่มี config จะไม่สร้างไฟล์ข้อมูลเอง
7. ไฟล์ใหม่ `src/events/messageReaction.js`: ลงทะเบียน messageReactionAdd/messageReactionRemove ใช้ message ID และ emoji ID (custom) หรือชื่อ emoji (มาตรฐาน) หาเฉพาะยศที่เกี่ยวข้อง ข้ามบอทและข้อความที่ไม่ได้ตั้งค่า ตรวจยศด้วย assertRoleManageable เดิม แล้วเพิ่ม/ถอดยศ
8. Event ใช้ข้อมูล ID จาก partial ได้ และ fetch เฉพาะข้อมูลที่จำเป็น รองรับข้อความและผู้ใช้ที่ไม่อยู่ใน cache หลัง restart จัดลำดับงานต่อสมาชิกเพื่อให้กด/ถอดเร็ว ๆ แล้วผลสุดท้ายตรงลำดับ events และไม่ชนกับการแก้คนละยศ ล้างคิวหลังจบงาน
9. ใช้ reaction ปกติสำหรับเลือกยศ ข้าม Super Reactions เพื่อไม่ให้การมี reaction สองชนิดของ emoji เดียวกันทำให้ถอดยศผิด
10. `src/index.js`: เปิด GuildMessageReactions intent และ Partials.Message, Partials.Reaction, Partials.User ตามการรับ events ที่ข้อมูลไม่อยู่ใน cache และติดตั้ง event ใหม่
11. อัปเดต `walkthrough.md` ด้วยการใช้งาน ผลตรวจ และสิทธิ์ที่ต้องตั้งใน Discord

รายละเอียดที่ใช้ในการทำงาน: ใช้ `getReactionEmojiKey` ใน helper เดิมร่วมกันเพื่อจับคู่ Unicode ที่มี/ไม่มี variation selector และ custom emoji ด้วย ID; บันทึก config ผ่านไฟล์ชั่วคราวแล้ว rename ก่อนอัปเดต cache เพื่อรักษาข้อมูลเดิมเมื่อ save ล้มเหลว

## ตรวจสอบก่อนส่งงาน
- ตรวจ syntax และ static import/export ของไฟล์ทั้งหมด ไม่เริ่มบอทหรือ dev server
- ตรวจ command builder: required/optional order, 10 คู่, จำนวน options, ความยาว command
- ตรวจด้วยข้อมูลจำลองในหน่วยความจำ: กดหลาย emoji ได้หลายยศ ถอดหนึ่งไม่กระทบอีกยศ ลำดับกด/ถอดเร็ว ๆ และข้อความ uncached หลัง restart
- ตรวจ emoji custom/Unicode, bot reactions, ข้อความอื่น, Super Reactions, ยศหายหรือสิทธิ์ไม่พอ, คู่ไม่ครบ/ซ้ำ และ cleanup กรณี setup ล้มเหลว
- ตรวจ defer ก่อนเครือข่าย และ Success หลังงานครบจริง รวมถึง response failure ต้องไม่สร้างข้อความซ้ำ
- ตรวจ git diff --check ไม่เพิ่ม dependency หรือไฟล์ tests ไม่มี lint script/TypeScript config ในโปรเจกต์นี้

## ขอบเขตข้อมูลและข้อจำกัด
- แก้เฉพาะโค้ดอ่าน/บันทึก config ที่บอทจะใช้เมื่อผู้ใช้เรียกคำสั่ง ไม่เปิด อ่าน เขียน หรือย้ายไฟล์ database จริงในระหว่างพัฒนา ไม่แก้ข้อมูลตั้งค่าเดิม
- ไม่ deploy/restart PM2 หรือเรียก Discord API จริง ผู้ใช้ทดสอบบนเซิร์ฟเวอร์หลังนำโค้ดขึ้น
- การกด/ถอดตอนบอทออฟไลน์ไม่รับประกันว่าจะย้อนหลังครบ; ไม่มีงานสแกนทุกสมาชิกหรือยศอัตโนมัติที่ไม่ได้ขอ
- การลบ reactions ทั้งหมดโดยแอดมินไม่อยู่ในขอบเขตรอบนี้ ระบบรองรับการกด/ถอดรายคนตามที่ขอ

---

# แผนงานเดิม: แก้ Discord interaction และบั๊กที่ตรวจพบ

สถานะ: ผู้ใช้อนุมัติแล้ว และดำเนินการเสร็จ ดูผลตรวจใน walkthrough.md

## ผลลัพธ์ที่ต้องการ
- ตอบรับ interaction ก่อนเรียกเครือข่ายหรือทำงานหนัก แล้วแจ้ง success เมื่อการส่งข้อความ/งานหลักสำเร็จจริง
- แยกความล้มเหลวของงานหลักออกจากความล้มเหลวในการส่งข้อความยืนยัน ไม่ส่งงานหลักซ้ำเพราะตอบกลับไม่สำเร็จ
- หาก Discord ปฏิเสธการตอบรับตั้งแต่ต้น ให้หยุดก่อนทำรายการ ไม่รับประกันการตอบกลับเมื่อ Discord หรือเครือข่ายใช้งานไม่ได้

## การเปลี่ยนแปลง
1. `src/commands/helper.js`: defer แบบส่วนตัวก่อนส่งข้อความ ใช้ editReply ยืนยัน success แยกการส่งออกจากการตอบยืนยัน และเลิก reply ซ้ำหลังหมดเวลา
2. `src/events/interactionCreate.js`: ตอบรับปุ่มรับยศ/อนุมัติ/ส่งฟอร์ม/Quiz ก่อนงานเครือข่าย ตรวจสิทธิ์บอท ลำดับยศ และ managed roles เพิ่มยศใหม่สำเร็จก่อนถอดยศเดิม เมื่อแจกยศไม่สำเร็จให้คงปุ่มสำหรับลองใหม่และรายงานข้อผิดพลาดตรงจริง ไม่รายงานได้รับ Pending หากไม่ได้รับ
3. ในไฟล์ interaction เดิม: ตรวจ session อายุ ลำดับคำถาม ตัวเลือก และคำถามที่ถูกลบ ป้องกันคะแนนซ้ำและคำตอบจากข้อความ Quiz เก่า ตรวจการทำรายการอนุมัติซ้อน แจ้งผลกรณีตั้งค่า Quiz เปลี่ยนระหว่างทำ
4. `src/utils/helper.js`: ลดการแก้ Webhook ซ้ำโดยติดตามชื่อและรูปที่ใช้แล้วในหน่วยความจำ อัปเดตเมื่อการตั้งค่าเปลี่ยน รักษาการส่งด้วย Helper และการส่งผ่านบอทเมื่อใช้ Webhook ไม่ได้
5. `src/commands/giverole.js`: ย้าย defer ก่อนการ fetch สมาชิก/บอท ตรวจยศที่แก้ไม่ได้ และแยกผลแจกยศสำเร็จออกจากปัญหาสร้างการ์ด
6. `src/commands/set/setIntro.js`: defer ก่อนส่ง Sticky ในทุกคำสั่งที่เกี่ยวข้อง ใช้ editReply และรายงานเมื่อบันทึกตั้งค่าสำเร็จแต่ส่ง Sticky ไม่สำเร็จ
7. `src/commands/image.js`: หยุดเมื่อ defer ล้มเหลว รายงานจำนวนสำเร็จ/ล้มเหลวตามจริง ไม่แจ้ง success หากได้ 0 รูป แบ่งรายการหมวดหมู่ให้ไม่เกินขีดจำกัดข้อความ
8. `src/events/ready.js` และไฟล์ `src/commands/**/*.js`, `src/events/interactionCreate.js` ที่ใช้ response options: เปลี่ยน ready เป็น clientReady และ ephemeral response option เป็น MessageFlags.Ephemeral โดยรักษาความเป็นส่วนตัวของคำตอบเดิม
9. `src/index.js` และจุด logging ในไฟล์ที่เกี่ยวข้อง: บันทึกเฉพาะชื่อ error, code และข้อความที่ตัดข้อมูลอ่อนไหว หลีกเลี่ยงทั้งก้อน error ที่มี interaction token และ payload เปลี่ยนคำอธิบาย Unknown interaction ให้ตรงกับการหมดเวลา
10. ใช้ helper เดิมใน `src/utils/permission.js` หากจำเป็นสำหรับตรวจยศร่วมกัน ไม่เพิ่ม dependency หรือไฟล์โค้ดใหม่

รายละเอียดไฟล์ที่เกี่ยวข้องกับ logging: `src/events/guildCreate.js`, `src/events/guildMemberAdd.js`, `src/events/messageCreate.js` ใช้ error summary เดียวกัน เพื่อไม่ให้ error จาก Webhook/REST ถูกบันทึกพร้อม token หรือ payload

## การตรวจสอบ
- ตรวจ diff และไล่ทุก caller ของฟังก์ชันที่เปลี่ยน ยืนยันว่าแต่ละเส้นทางตอบรับเพียงครั้งเดียวและจบด้วยผลจริง
- ตรวจว่าเส้นทางส่งสำเร็จแล้วตอบยืนยันล้มเหลวไม่ส่งข้อความซ้ำ ไม่รายงานว่าส่งไม่สำเร็จ
- ตรวจเส้นทางสิทธิ์ไม่พอ ยศสูงกว่าบอท ไฟล์ดาวน์โหลดล้มเหลว Quiz กดซ้ำ/คำถามถูกลบ และอนุมัติซ้อน
- ตรวจ syntax แบบ static ของไฟล์ JavaScript ที่แก้ ไม่มีการรันบอทหรือเชื่อม Discord/ฐานข้อมูล
- โครงการจริงเป็น JavaScript ไม่มี TypeScript config หรือ lint script จึงไม่ติดตั้งเครื่องมือหรืออ้างว่าผ่าน tsc/lint ที่ไม่มี
- เขียน `walkthrough.md` ระบุสิ่งที่แก้ ผลตรวจ และรายการที่ผู้ใช้ต้องทดสอบบนเซิร์ฟเวอร์จริง เช่น /helper talk พร้อมรูป ปุ่มแจกยศ และฟอร์ม

## ข้อจำกัด
- 50013 ที่เกิดจากสิทธิ์/ลำดับยศบนเซิร์ฟเวอร์ต้องให้ผู้ดูแลปรับใน Discord โค้ดจะตรวจและแจ้งสาเหตุ ไม่สามารถเพิ่มสิทธิ์ให้ตัวเอง
- ไม่รัน dev server ไม่เพิ่ม tests/config/dependency ไม่ deploy หรือ restart PM2
