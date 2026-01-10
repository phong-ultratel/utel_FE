import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TermsPoliciesService } from '../../services/terms-policies.service';

export interface PolicySection {
  id: string;
  title: string;
  content: string;
}

@Component({
  selector: 'app-terms-policies',
  templateUrl: './terms-policies.component.html',
  styleUrls: ['./terms-policies.component.scss']
})
export class TermsPoliciesComponent implements OnInit, OnDestroy {
  showModal: boolean = false;
  selectedSection: string = 'terms-of-use';
  private subscription?: Subscription;

  policySections: PolicySection[] = [
    {
      id: 'terms-of-use',
      title: 'Điều khoản sử dụng',
      content: `
        <h3>1. Giới thiệu</h3>
        <p>Chào mừng bạn đến với dịch vụ của chúng tôi. Bằng việc sử dụng dịch vụ này, bạn đồng ý với các điều khoản và điều kiện được nêu trong tài liệu này.</p>
        
        <h3>2. Điều kiện sử dụng</h3>
        <p>Khi sử dụng dịch vụ, bạn cam kết:</p>
        <ul>
          <li>Cung cấp thông tin chính xác và đầy đủ</li>
          <li>Không sử dụng dịch vụ cho mục đích bất hợp pháp</li>
          <li>Bảo mật thông tin tài khoản của mình</li>
          <li>Tuân thủ mọi quy định pháp luật hiện hành</li>
        </ul>
        
        <h3>3. Quyền và trách nhiệm</h3>
        <p>Chúng tôi có quyền từ chối hoặc chấm dứt dịch vụ đối với bất kỳ người dùng nào vi phạm các điều khoản này.</p>
        
        <h3>4. Thay đổi điều khoản</h3>
        <p>Chúng tôi có quyền thay đổi các điều khoản này bất cứ lúc nào. Việc tiếp tục sử dụng dịch vụ sau khi có thay đổi được coi là bạn đã chấp nhận các điều khoản mới.</p>
      `
    },
    {
      id: 'purchase-terms',
      title: 'Điều khoản mua hàng',
      content: `
        <h3>1. Đơn hàng và thanh toán</h3>
        <p>Khi bạn đặt mua gói cước, bạn đồng ý thanh toán đầy đủ số tiền theo giá đã công bố tại thời điểm đặt hàng.</p>
        
        <h3>2. Xác nhận đơn hàng</h3>
        <p>Sau khi nhận được đơn hàng, chúng tôi sẽ gửi email xác nhận đến địa chỉ email bạn đã cung cấp. Đơn hàng chỉ được coi là hợp lệ sau khi thanh toán thành công.</p>
        
        <h3>3. Giá cả và thuế</h3>
        <p>Tất cả giá cả đã bao gồm thuế VAT (nếu có). Giá có thể thay đổi mà không cần thông báo trước, nhưng đơn hàng đã thanh toán sẽ không bị ảnh hưởng.</p>
        
        <h3>4. Hoàn tiền và hủy đơn</h3>
        <p>Bạn có thể hủy đơn hàng trong vòng 24 giờ sau khi thanh toán. Sau thời gian này, việc hoàn tiền sẽ được xem xét theo từng trường hợp cụ thể.</p>
        
        <h3>5. Kích hoạt dịch vụ</h3>
        <p>Dịch vụ sẽ được kích hoạt trong vòng 24-48 giờ sau khi thanh toán thành công. Bạn sẽ nhận được thông báo qua SMS hoặc email khi dịch vụ được kích hoạt.</p>
      `
    },
    {
      id: 'payment-policy',
      title: 'Chính sách thanh toán',
      content: `
        <h3>1. Phương thức thanh toán</h3>
        <p>Chúng tôi chấp nhận các phương thức thanh toán sau:</p>
        <ul>
          <li>Thẻ tín dụng/ghi nợ (Visa, Mastercard)</li>
          <li>Ví điện tử (MoMo, ZaloPay, VNPay)</li>
          <li>Chuyển khoản ngân hàng</li>
          <li>Thanh toán qua cổng thanh toán trực tuyến</li>
        </ul>
        
        <h3>2. Bảo mật thanh toán</h3>
        <p>Tất cả các giao dịch thanh toán đều được mã hóa và bảo mật theo tiêu chuẩn PCI DSS. Chúng tôi không lưu trữ thông tin thẻ tín dụng của bạn.</p>
        
        <h3>3. Xử lý thanh toán</h3>
        <p>Thanh toán sẽ được xử lý ngay lập tức. Nếu có bất kỳ vấn đề nào với giao dịch, vui lòng liên hệ bộ phận hỗ trợ khách hàng.</p>
        
        <h3>4. Hóa đơn</h3>
        <p>Sau khi thanh toán thành công, hóa đơn điện tử sẽ được gửi đến email của bạn trong vòng 24 giờ.</p>
        
        <h3>5. Lỗi thanh toán</h3>
        <p>Nếu giao dịch bị lỗi nhưng tiền đã bị trừ, vui lòng liên hệ chúng tôi ngay lập tức. Chúng tôi sẽ kiểm tra và hoàn tiền trong vòng 5-7 ngày làm việc.</p>
      `
    },
    {
      id: 'privacy-policy',
      title: 'Chính sách bảo vệ dữ liệu cá nhân',
      content: `
        <h3>1. Thu thập thông tin</h3>
        <p>Chúng tôi thu thập các thông tin sau để cung cấp dịch vụ:</p>
        <ul>
          <li>Thông tin cá nhân: Họ tên, số điện thoại, email, địa chỉ</li>
          <li>Thông tin thanh toán: Số thẻ, thông tin tài khoản ngân hàng</li>
          <li>Thông tin sử dụng dịch vụ: Lịch sử giao dịch, gói cước đã đăng ký</li>
        </ul>
        
        <h3>2. Mục đích sử dụng</h3>
        <p>Thông tin của bạn được sử dụng để:</p>
        <ul>
          <li>Cung cấp và quản lý dịch vụ</li>
          <li>Xử lý thanh toán và giao dịch</li>
          <li>Gửi thông báo và cập nhật về dịch vụ</li>
          <li>Cải thiện chất lượng dịch vụ</li>
          <li>Tuân thủ các yêu cầu pháp lý</li>
        </ul>
        
        <h3>3. Bảo mật thông tin</h3>
        <p>Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn bằng các biện pháp bảo mật tiên tiến, bao gồm:</p>
        <ul>
          <li>Mã hóa dữ liệu trong quá trình truyền tải</li>
          <li>Bảo mật cơ sở dữ liệu với các lớp bảo vệ</li>
          <li>Giới hạn quyền truy cập thông tin</li>
          <li>Kiểm tra và giám sát định kỳ</li>
        </ul>
        
        <h3>4. Chia sẻ thông tin</h3>
        <p>Chúng tôi không bán, cho thuê hoặc chia sẻ thông tin cá nhân của bạn với bên thứ ba, trừ các trường hợp:</p>
        <ul>
          <li>Có sự đồng ý của bạn</li>
          <li>Yêu cầu của cơ quan pháp luật</li>
          <li>Nhà cung cấp dịch vụ đáng tin cậy (với cam kết bảo mật)</li>
        </ul>
        
        <h3>5. Quyền của người dùng</h3>
        <p>Bạn có quyền:</p>
        <ul>
          <li>Truy cập và xem thông tin cá nhân của mình</li>
          <li>Yêu cầu chỉnh sửa hoặc xóa thông tin</li>
          <li>Từ chối nhận email marketing</li>
          <li>Khiếu nại về việc xử lý dữ liệu</li>
        </ul>
        
        <h3>6. Cookie và công nghệ theo dõi</h3>
        <p>Chúng tôi sử dụng cookie để cải thiện trải nghiệm người dùng. Bạn có thể tắt cookie trong cài đặt trình duyệt, nhưng điều này có thể ảnh hưởng đến một số chức năng của website.</p>
        
        <h3>7. Thay đổi chính sách</h3>
        <p>Chúng tôi có thể cập nhật chính sách này định kỳ. Mọi thay đổi sẽ được thông báo trên website và qua email.</p>
        
        <h3>8. Liên hệ</h3>
        <p>Nếu bạn có câu hỏi về chính sách bảo mật, vui lòng liên hệ:</p>
        <p>Email: privacy@utel.vn<br>
        Điện thoại: 1900-xxxx<br>
        Địa chỉ: [Địa chỉ công ty]</p>
      `
    }
  ];

  constructor(private termsPoliciesService: TermsPoliciesService) { }

  ngOnInit(): void {
    this.subscription = this.termsPoliciesService.openModal$.subscribe(sectionId => {
      if (sectionId) {
        this.selectedSection = sectionId;
      }
      this.openModal();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  openModal(): void {
    this.showModal = true;
    this.selectedSection = 'terms-of-use';
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.showModal = false;
    document.body.style.overflow = '';
  }

  selectSection(sectionId: string): void {
    this.selectedSection = sectionId;
  }

  getCurrentSection(): PolicySection | undefined {
    return this.policySections.find(section => section.id === this.selectedSection);
  }
}

