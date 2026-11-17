# LAST BLOOM – bản playable prototype

Bản game HTML5/CSS3/JavaScript chạy trực tiếp trên trình duyệt, không cần cài đặt thư viện hoặc server.

## Chạy game
1. Giải nén ZIP.
2. Mở `index.html` bằng Chrome, Firefox hoặc Edge.
3. Chọn một thẻ tướng ở thanh dưới bên trái.
4. Chọn một ô trên sân để bố trí tướng. Mỗi tướng chiếm đúng **1 cột × 2 hàng**.
5. Bấm **START**. Quái xuất hiện theo xác suất cấu hình, đứng trên đường và tấn công đội hình/căn cứ.
6. Tướng tự động chiến đấu. Dọn sạch đợt để nhận COIN và hồi căn cứ; đợt tiếp theo tự mở sau 30 giây hoặc dùng **SKIP**.

## Điều khiển
- Click thẻ tướng: chọn / bỏ chọn.
- Click ô lưới: bố trí tướng.
- Click nút giữa: bắt đầu, tạm dừng hoặc tiếp tục trận.
- Click **SKIP**: bỏ qua thời gian chờ giữa hai đợt.
- Click **UP** trên tướng: chọn HP, ATK, DEF, SA hoặc RC để nâng cấp bằng COIN.
- Click 4 kỹ năng (theo thứ tự hiển thị): Hồi phục, Tiếp tế, Đóng băng, Bộc phá; tất cả miễn phí, hồi chiêu lần lượt 5 giây, 9 giây, 10 giây và 0,25 giây.
- Phím `1`–`4`: dùng kỹ năng theo thứ tự hiển thị.
- `Esc`: bỏ chọn tướng.

## Nhân vật theo `assets/character/Guide.docx`
- C1–C5 là đội hình người chơi; ảnh chân dung, đòn đánh thường (`_N`) và chiêu cuối (`_U`) được nạp trực tiếp từ `assets/character/`.
- M1–M5 là quái vật; ảnh và hai ảnh hành động tương ứng cũng được dùng trong trận.
- Mỗi đòn đánh tạo ảnh bay từ vị trí người tấn công đến mục tiêu: C1–C5 dùng `_N` cho đòn thường, `_U` cho chiêu cuối; M1–M5 dùng cùng quy tắc. Chỉ số chiến đấu được khai báo trong `js/config.js`.
- HUMAN/DEMON dùng HP, ATK, SA (đòn/giây), RC (hồi HP mỗi 5 giây), DEF và danh sách skill.
- Quái có xác suất xuất hiện, số lượng tối thiểu/tối đa và COIN thưởng theo từng loại.

## Menu Settings
- Bấm **⚙ SETTINGS** để mở Character Management, Monster Management, Skill Management, Mod Management và Game Settings.
- Có thể thêm, sửa, xóa và khôi phục thông số mặc định của tướng, quái và kỹ năng; các ảnh đại diện, đánh thường, kỹ năng N/U có thể chọn từ đường dẫn hoặc tải lên (PNG/JPG/WebP/GIF, tối đa 300 KB mỗi ảnh).
- Tướng và quái hỗ trợ chỉnh HP, ATK, SA, RC, DEF, COIN, kỹ năng trang bị và thông số bổ sung; quái có thêm SPAWN_CHANCE và SPAWN_QUANTITY tối thiểu/tối đa.
- Mod được lưu độc lập, có thể bật/tắt, sửa hoặc gỡ. Cấu hình mod dùng JSON với các nhóm `resources`, `characters`, `monsters`, `skills`; chỉ các chỉ số gameplay được phép mới được chấp nhận.
- **GAME SETTINGS** giữ các điều chỉnh COIN, căn cứ, kỹ năng chủ động và hiệu ứng. Thông số đã lưu không ghi đè cấu hình gốc; các mục mặc định đã xóa có thể khôi phục.
- Tần suất hiệu ứng nhấp nhô của tướng và quái chỉnh được từ 0,3–3 lần/giây trong GAME SETTINGS; lựa chọn được áp dụng tức thì và lưu tự động.
- Dữ liệu tùy chỉnh lưu riêng trong Local Storage của trình duyệt. Chọn **ÁP DỤNG CHO TRẬN MỚI** để tải lại và nạp cấu hình; nếu đang có trận, game sẽ hỏi xác nhận trước khi tải lại.

## Gameplay và hiệu ứng
- Lưới 12 × 8 = 96 ô, hitbox đặt tướng 1 × 2.
- Kiểm tra ô trống, không cho đặt chồng lên nhau hoặc ra ngoài lưới.
- 5 tướng có thể nâng cấp; mỗi lần tăng HP 10%, ATK 6%, DEF 8%, SA 10% hoặc RC 10%.
- COIN khởi đầu 2500; nhận thêm khi hạ quái và dọn đợt, dùng để gọi tướng, nâng cấp và dùng skill.
- Có 12 hiệu ứng: STUN, LIFESTEAL, ARMOR_REDUCTION, HEALING_REDUCTION, SLOW, TEAM_HEAL, CRITICAL, ARMOR_PENETRATION, SLOW_RESISTANCE, CLR, RATK, RDEF.
- Hiệu ứng cùng loại không cộng dồn: hiệu lực mạnh hơn được giữ và thời hạn được làm mới. STUN chặn hành động; hồi máu bị giới hạn bởi HP tối đa.
- Quái xuất hiện trên đường và không di chuyển.
- Trụ phe người dùng ảnh `assets/town/hometown.gif`, chiếm 2 cột × 2 hàng ở giữa hàng 7–8 của lưới (cột 6–7). Chỉ 4 ô này bị chặn bố trí tướng.
- Quái phe DEMON luôn ưu tiên tấn công tướng HUMAN còn sống trên toàn sân, không phụ thuộc khoảng cách làn. Chỉ khi không còn tướng HUMAN chúng mới đánh trụ; nếu tướng mới được bố trí trong lúc đòn đang bay về trụ, projectile sẽ chuyển hướng sang tướng.
- Sau mỗi đợt, ATK/DEF quái tăng cộng dồn 10%; một thuộc tính quái được chọn ngẫu nhiên tăng thêm 10%. Căn cứ hồi 3% HP tối đa.
- Có đếm ngược 30 giây, **SKIP**, tạm dừng, kết thúc và chơi lại.
- Lưu kỷ lục đợt cao nhất bằng Local Storage.

## Mặc định cân bằng
- Tài liệu không quy định đầy đủ giá nâng cấp, tỷ lệ spawn, RC/SA/DEF mặc định hay cách tính DEF; các mặc định này được đặt trong `js/config.js` để dễ điều chỉnh.
- Chi phí nâng cấp mặc định là 150 COIN, tăng thêm 75 COIN sau mỗi lần nâng trên cùng tướng.
- DEF giảm sát thương theo công thức `ATK × 100 / (100 + DEF)`; giảm giáp và xuyên giáp áp dụng theo tỷ lệ phần trăm.

## Tài nguyên
- Nhân vật và quái vật: `assets/character/` (`C1`–`C5`, `M1`–`M5` cùng ảnh `_N` và `_U`).
- Kỹ năng: `assets/skills/`
- Background: `assets/backgrounds/battlefield.png`

## Chỉnh kích thước lưới
Trong `js/config.js`:
- `gridWidth`: chiều ngang lưới (% vùng sân).
- `gridHeight`: chiều cao lưới (% vùng sân).
- `gridTop`: vị trí bắt đầu lưới.
- `columns`, `rows`: số cột và hàng. Mặc định 12 × 8.

Lưu ý: giữ `columns: 12` và `rows: 8` để đúng thiết kế đã duyệt. Khi thay asset, nên giữ PNG nền trong suốt và không thêm khoảng trắng lớn quanh nhân vật.
